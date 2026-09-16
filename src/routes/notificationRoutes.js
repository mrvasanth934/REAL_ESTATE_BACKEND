const router = require("express").Router();
const { protect, tenantScope } = require("../middleware/authMiddleware");
const notification = require("..//controllers/notificationController");
router.use(protect, tenantScope);
router.post('/', notification.getMyNotifications)
router.put('/read', notification.updateManyNotificationReadStatus);
router.post('/delete-selected', notification.deleteManyNotifications);
router.put('/:id', notification.updateSingleNotificationReadStatus)
router.delete('/:id', notification.deleteSingleNotification)
module.exports = router;
