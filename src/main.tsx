import { Devvit, MenuItemOnPressEvent, Subreddit, User } from '@devvit/public-api';

// Enable Redis and Reddit API plugins
Devvit.configure({
  redis: true,
  redditAPI: true,
});

// Define Flair template ID and levels 
const subreddit_name = '58E8LN7BP'
const FLAIR_IDS_BY_LEVEL: Record<number, string> = {
  0: '2a73bbd6-5caa-11ef-ad39-8ec6516befd2',
  1: '315a4640-5caa-11ef-a834-924e26908fa3',
  2: '36fd250e-5caa-11ef-8cb8-2ebfbdd73cac'
  // Add more levels as needed
};

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

  const author = await reddit.getUserById(thing.authorId!);
  return author.username;
}

// Get current user level from Redis
async function getUserLevel(username: string, context: Devvit.Context) {
  const levelStr = await context.redis.get(`user_level:${username}`);
  return levelStr ? parseInt(levelStr) : 0;
}

// Handle promotion or demotion 
async function handlePromoteOrDemote(event: MenuItemOnPressEvent, context: Devvit.Context, action: 'promote' | 'demote') {
  const { ui, reddit } = context;
  const username = await getUsername(event, context);

  let currentLevel = await getUserLevel(username, context);

  if (action === 'promote') {
    currentLevel++;
  } else if (action === 'demote' && currentLevel > 0) {
    currentLevel--;
  }

  // Ensure level is within valid range
  const maxLevel = Math.max(...Object.keys(FLAIR_IDS_BY_LEVEL).map(Number));
  currentLevel = Math.min(Math.max(currentLevel, 0), maxLevel);

  // Update level in Redis
  await context.redis.set(`user_level:${username}`, currentLevel.toString());

  // Store the timestamp of the promotion/demotion
  const timestamp = Date.now();
  await context.redis.set(`user_last_action_time:${username}`, timestamp.toString());

  // Update user flair (using subreddit.flair.set from tutorial)
  const flairId = FLAIR_IDS_BY_LEVEL[currentLevel] || 'default-flair-id';
  const options = {
    username: username,
    flairTemplateId: flairId,
    subredditName: subreddit_name
  }
  await context.reddit.setUserFlair(options);

  ui.showToast(`${action === 'promote' ? 'Promoted' : 'Demoted'} user ${username} to level ${currentLevel}`);
}

// Handle checking the last promotion/demotion time
async function handleCheckLastAction(event: MenuItemOnPressEvent, context: Devvit.Context) {
  const { ui } = context;
  const username = await getUsername(event, context);

  const timestampStr = await context.redis.get(`user_last_action_time:${username}`);
  if (timestampStr) {
    const timestamp = parseInt(timestampStr);
    const date = new Date(timestamp);
    ui.showToast(`Last action for ${username} was on ${date.toLocaleString()}`);
  } else {
    ui.showToast(`No promotion/demotion history found for ${username}`);
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
