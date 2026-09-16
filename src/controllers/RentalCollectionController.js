const RentalBooking = require("../models/rentalBooking");

exports.addRentalCollection = async (req, res) => {
  try {
    const {
      rental_tenant_id,
      property_id,
      amount,
      rent,
      dueDate,
      status,
      remarks,
      paymentMethod,
    } = req.body;

    const booking = await RentalBooking.findOne({
      rental_tenant_id: rental_tenant_id,
      property_id: property_id,
      status: "active",
    });

    if (!booking) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Active booking not found for this tenant and property",
        });
    }

    const newCollection = {
      amount,
      rent,
      dueDate,
      status,
      paymentMethod,
      remarks,
    };

    booking.rental_collection.push(newCollection);

    await booking.save();

    res
      .status(201)
      .json({
        success: true,
        message: "Rental collection added successfully",
        data: booking,
      });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error adding collection",
        error: error.message,
      });
  }
};

exports.updateRentalCollection = async (req, res) => {
  try {
    const collectionId = req.params.id;
    const { amount, rent, dueDate, status, remarks, paymentMethod } = req.body;

    const updatedBooking = await RentalBooking.findOneAndUpdate(
      { "rental_collection._id": collectionId },
      {
        $set: {
          "rental_collection.$.amount": amount,
          "rental_collection.$.rent": rent,
          "rental_collection.$.dueDate": dueDate,
          "rental_collection.$.status": status,
          "rental_collection.$.paymentMethod": paymentMethod,
          "rental_collection.$.remarks": remarks,
        },
      },
      { new: true },
    );

    if (!updatedBooking) {
      return res
        .status(404)
        .json({ success: false, message: "Collection record not found" });
    }

    res
      .status(200)
      .json({
        success: true,
        message: "Rental collection updated successfully",
        data: updatedBooking,
      });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error updating collection",
        error: error.message,
      });
  }
};
