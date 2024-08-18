# About

This is an app for mods to manage promoting and demoting users in their subreddits. 

## Configuration

Please input the subreddit name where the app is installed on. It's needed for the flair setting.

The flair ID's need to be taken from the mod tools here: https://www.reddit.com/mod/SUBREDDITNAMEHERE/userflair.

The flairs need to be each on their separate new line like this:

```
69f740c1-3882-4006-9755-9386c59c317d\n
b2a1e3f4-d5c6-4a7b-a8d3-0f1c7e0d4b2f\n
03c8f9a5-1b2d-4e60-b7f1-a63e2c4d5f08\n
e7d26b3a-f019-4c53-832a-3d61f4b0c9e2\n
5a43c1d7-8e3f-42b9-91c0-7f2d3a1e6b5c\n
```

The newline character `\n` is only there for illustrative purposes. The top-most flair will be counted as the lowest level that a user can be demoted to.