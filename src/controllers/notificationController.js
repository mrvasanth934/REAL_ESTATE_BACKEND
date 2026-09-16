const Notification = require("../models/Notification");

const createNotification = async (to = "null", sentRole = "null", title, message, links,) => {
  try {
    const notification = await Notification.create({
      to: to ? to : null,

      sentRole,

      title: title.trim(),

      message: message.trim(),


      links,
    });

    return notification

  } catch (error) {
    return error
  }
};


const getMyNotifications = async (req, res) => {
  try {
    const { role, user_or_tenent_id } = req.body;
    console.log(role, user_or_tenent_id);

    if (!role || !user_or_tenent_id) {
      return res.status(400).json({
        success: false,
        message: "cant`t get notification"
      })
    }

    if (role == "super_admin") {
      const notifications = await Notification.find({ sentRole: role })
      return res.status(200).json({
        success: true,
        message: "notification fetched",
        notifications
      })
    }
    else {
      const notifications = await Notification.find({ to: user_or_tenent_id })
      return res.status(200).json({
        success: true,
        message: "notification fetched",
        notifications
      })
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

const updateSingleNotificationReadStatus = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Notification id is required"
      })
    }
    const updateNotification = await Notification.updateOne({ _id: id }, { isRead: true })
    console.log(updateNotification);

    return res.status(200).json({
      success: true,
      message: "notification  updated"
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

const updateManyNotificationReadStatus = async (req, res) => {
  try {
    const ids = req.body
    const updateeNotifications = await Notification.updateMany(
      {
        _id: { $in: ids }
      },
      {
        $set: {
          isRead: true
        }
      }
    );

    return res.status(200).json({
      success: false,
      message: "notification updated"
    })

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

const deleteSingleNotification = async (req, res) => {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(400), json({
        success: false,
        message: "delete notificaion id is required"
      })
    }
    const deleteNotification = await Notification.deleteOne({ _id: id })
    return res.status(200).json({
      success: true,
      message: "notification deleted"
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }

}
const deleteManyNotifications = async (req, res) => {
  try {
    const ids = req.body
    await Notification.deleteMany({ _id: { $in: ids } })
    return res.status(200).json({
      success: false,
      message: "notification deleted"
    })
  } catch (error) {
    return res.status(500).josn({
      success:false,
      error:error.message
    })
  }
}

module.exports = {
  createNotification,
  getMyNotifications,
  updateSingleNotificationReadStatus,
  updateManyNotificationReadStatus,
  deleteSingleNotification,
  deleteManyNotifications
};
