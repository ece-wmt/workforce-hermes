// Notification utility for desktop notifications

export const initNotifications = () => {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return;
  }

  if (Notification.permission === "granted") {
    return;
  }

  if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        console.log("Notification permission granted");
      }
    });
  }
};

export const sendNotification = (title, options = {}) => {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  const defaultOptions = {
    icon: "/notification-icon.png",
    tag: "wf-hermes-notification",
    requireInteraction: false,
    ...options,
  };

  try {
    new Notification(title, defaultOptions);
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
};

export const notifyTaskUpdated = (taskTitle) => {
  sendNotification("Task Updated", {
    body: `"${taskTitle}" has been updated`,
    tag: "task-update",
  });
};

export const notifyFeatureAdded = (taskTitle, featureName) => {
  sendNotification("Feature/Bug Added", {
    body: `"${featureName}" added to "${taskTitle}"`,
    tag: "feature-add",
  });
};

export const notifyFeatureCompleted = (taskTitle, featureName) => {
  sendNotification("Feature/Bug Completed", {
    body: `"${featureName}" in "${taskTitle}" is now complete`,
    tag: "feature-complete",
  });
};

export const notifyNoteAdded = (taskTitle, notePreview) => {
  sendNotification("Note Added", {
    body: `New note on "${taskTitle}": ${notePreview.substring(0, 50)}${notePreview.length > 50 ? "..." : ""}`,
    tag: "note-add",
  });
};

export const notifyMilestoneCompleted = (taskTitle, milestoneName) => {
  sendNotification("Milestone Completed", {
    body: `"${milestoneName}" in "${taskTitle}" is complete`,
    tag: "milestone-complete",
  });
};
