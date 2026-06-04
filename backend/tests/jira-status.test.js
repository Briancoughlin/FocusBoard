/**
 * Tests for the mapJiraStatus function from routes/jira.js
 * The function is copied here since it is not exported from the module.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Copy of mapJiraStatus from backend/routes/jira.js
function mapJiraStatus(statusName, statusCategory) {
  const name = (statusName || '').toLowerCase();
  if (name.includes('ready to start'))          return 'todo';
  if (name.includes('in progress'))             return 'inprogress';
  if (name.includes('in review'))               return 'inprogress';
  if (name.includes('blocked'))                 return 'waiting';
  if (name.includes('on hold'))                 return 'waiting';
  if (name.includes('waiting for customer'))    return 'waiting';
  if (name.includes('release'))                 return 'waiting';
  if (name.includes('done'))                    return 'done';
  switch (statusCategory) {
    case 'To Do':       return 'todo';
    case 'In Progress': return 'inprogress';
    case 'Done':        return 'done';
    default:            return 'waiting';
  }
}

test('Ready to Start maps to todo', () => {
  assert.equal(mapJiraStatus('Ready to Start', 'To Do'), 'todo');
});

test('In Progress maps to inprogress', () => {
  assert.equal(mapJiraStatus('In Progress', 'In Progress'), 'inprogress');
});

test('In Review maps to inprogress', () => {
  assert.equal(mapJiraStatus('In Review', 'In Progress'), 'inprogress');
});

test('On Hold/Blocked maps to waiting', () => {
  assert.equal(mapJiraStatus('On Hold/Blocked', 'In Progress'), 'waiting');
});

test('Waiting for Customer maps to waiting', () => {
  assert.equal(mapJiraStatus('Waiting for Customer', 'In Progress'), 'waiting');
});

test('Done maps to done', () => {
  assert.equal(mapJiraStatus('Done', 'Done'), 'done');
});

test('Unknown status with category To Do maps to todo', () => {
  assert.equal(mapJiraStatus('Some Custom Status', 'To Do'), 'todo');
});

test('Unknown status with category Done maps to done', () => {
  assert.equal(mapJiraStatus('Some Custom Status', 'Done'), 'done');
});

test('Unknown status with unknown category maps to waiting', () => {
  assert.equal(mapJiraStatus('Some Custom Status', 'Unknown Category'), 'waiting');
});
