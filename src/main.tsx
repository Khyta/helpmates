import { Devvit, MenuItemOnPressEvent, SettingScope } from '@devvit/public-api';

// Enable Redis and Reddit API plugins
Devvit.configure({
  redis: true,
  redditAPI: true,
});

Devvit.addSettings([
  {
    type: 'string',
    name: 'subreddit_name',
    label: 'Subreddit Name',
  },
  {
    type: 'paragraph',
    name: 'flair_ids_by_level',
    label: 'Enter a new flair ID on each new line',
    onValidate: (event) => {
      if (event.value === undefined) {
        return 'Please enter at least one flair ID.';
      }
      const flairIds = event.value.split('\n');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

      for (const flairId of flairIds) {
        if (!uuidRegex.test(flairId.trim())) {
          return 'Invalid flair ID format detected. Please ensure each flair ID is a valid UUID and is on a separate line.';
        }
      }
    }
  },
]);


// Get username from event 
async function getUsername(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { location, targetId } = event;
  const { reddit } = context;
  let thing;

  if (location === 'post') {
    thing = await reddit.getPostById(targetId);
  } else if (location === 'comment') {
    thing = await reddit.getCommentById(targetId);
  } else {
    throw 'Cannot find a post or comment with that ID';
  }

  // Check if authorId exists before proceeding
  if (!thing.authorId) {
    throw 'The post or comment does not have an authorId'; // Or handle it differently
  }

  const author = await reddit.getUserById(thing.authorId);

  // Optional: Handle the case where author itself is undefined
  if (!author) {
    throw 'Could not find the author'; // Or handle it differently
  }

  // Provide a default value or handle the case where username is undefined
  return author.username || '[deleted]';
}

// Get current user level from Redis 
async function getUserLevel(username: string, context: Devvit.Context) {
  const levelStr = await context.redis.get(`user_level:${username}`);
  return levelStr ? parseInt(levelStr) : 0;
}

// Fetch flair text for a given flair template ID (modified to use dynamic subreddit name)
async function getFlairText(flairTemplateId: string, context: Devvit.Context): Promise<string | null> {
  try {
    const subredditName = await context.settings.get('subreddit_name');
    const subreddit = await context.reddit.getSubredditByName(subredditName);
    const flairTemplates = await subreddit.getUserFlairTemplates();
    const flairTemplate = flairTemplates.find(template => template.id === flairTemplateId);

    if (flairTemplate?.text) {
      const filteredText = flairTemplate.text.replace(/:[\w-]+:/g, '');
      return filteredText;
    } else {
      return null;
    }

  } catch (error) {
    console.error("Error fetching flair text:", error);
    return null;
  }
}

// Handle promotion or demotion (modified to use dynamic flair IDs)
// Handle promotion or demotion (modified to use dynamic flair IDs)
async function handlePromoteOrDemote(event: MenuItemOnPressEvent, context: Devvit.Context, action: 'promote' | 'demote') {
  const { ui, reddit, settings } = context;
  const username = await getUsername(event, context);
  let currentLevel = await getUserLevel(username, context);

  // Fetch flair IDs from settings and split by new line
  const flairIdsByLevelString = await settings.get('flair_ids_by_level');
  const flairIds = flairIdsByLevelString.split('\n').map(id => id.trim());

  // Ensure level is within valid range BEFORE modifying it
  const maxLevel = flairIds.length - 1;
  const minLevel = 0;

  if (action === 'promote' && currentLevel < maxLevel) {
    currentLevel++;
  } else if (action === 'demote' && currentLevel > minLevel) {
    currentLevel--;
  } else {
    const message = action === 'promote'
      ? "No more levels to promote to"
      : "No more levels to demote to";
    ui.showToast(message);
    return;
  }

  // Update level in Redis
  await context.redis.set(`user_level:${username}`, currentLevel.toString());

  // Store the timestamp of the promotion/demotion AND the action performed
  const timestamp = Date.now();
  await context.redis.set(`user_last_action_time:${username}`, timestamp.toString());
  await context.redis.set(`user_last_action:${username}`, action);

  // Update user flair
  const flairId = flairIds[currentLevel] || 'default-flair-id';
  const flairText = await getFlairText(flairId, context);

  const subredditName = await context.settings.get('subreddit_name');
  const options = {
    username: username,
    flairTemplateId: flairId,
    subredditName: subredditName
  }
  await context.reddit.setUserFlair(options);

  ui.showToast(`${action === 'promote' ? 'Promoted' : 'Demoted'} user ${username} to flair: ${flairText}`);
}

// Handle checking the last promotion/demotion time 
async function handleCheckLastAction(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { ui } = context;

  try {
    const username = await getUsername(event, context);

    const timestampStr = await context.redis.get(`user_last_action_time:${username}`);
    const lastAction = await context.redis.get(`user_last_action:${username}`);

    if (timestampStr) {
      const timestamp = parseInt(timestampStr);
      const date = new Date(timestamp);
      const formattedDate = date.toISOString().slice(0, 19).replace('T', ' '); // Format as YYYY-MM-DD HH:MM:SS
      ui.showToast(`Last action for ${username} was a ${lastAction} on ${formattedDate} (UTC)`);
    } else {
      ui.showToast(`No promotion/demotion history found for ${username}`);
    }

  } catch (error) {
    console.error("Error in handleCheckLastAction:", error);
    ui.showToast("Something went wrong while checking the last action. Please try again later.");
  }
}

// Add menu items 
Devvit.addMenuItem({
  location: 'comment',
  forUserType: 'moderator',
  label: 'Promote',
  onPress: (event, context) => handlePromoteOrDemote(event, context, 'promote'),
});

Devvit.addMenuItem({
  location: 'comment',
  forUserType: 'moderator',
  label: 'Demote',
  onPress: (event, context) => handlePromoteOrDemote(event, context, 'demote'),
});

// New menu item for checking last action
Devvit.addMenuItem({
  location: 'comment',
  forUserType: 'moderator',
  label: 'Check Last Promotion/Demotion',
  onPress: handleCheckLastAction,
});

export default Devvit;