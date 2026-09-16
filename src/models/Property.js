const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true, // mandatory + indexed for fast tenant-scoped queries
    },
    listed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // user_id mandatory
    },
    title: { type: String, required: true, trim: true },

    property_type: {
      type: String,
      enum: ["residential", "commercial", "land", "agricultural"],
      required: true,
    },
    listing_type: {
      type: String,
      enum: ["sale", "rent", "lease"],
      required: true,
    },
    sub_type: {
      type: String,
      enum: ["apartment", "villa", "plot", "office", "shop", "warehouse"],
    },
    status: {
      type: String,
      enum: ["available", "hold", "booked", "sold", "rented", "inactive"],
      default: "available",
    },
    propertyUsedTenant:{
      type:mongoose.Schema.Types.ObjectId,
        ref:"RentalTenant"
    },
    price: { type: Number, required: true },
    price_negotiable: { type: Boolean, default: false },
    maintenance_charge: { type: Number, default: 0 },
    security_deposit: { type: Number, default: 0 },

    area_sqft: Number,
    carpet_area: Number,
    built_up_area: Number,
    bedrooms: Number,
    bathrooms: Number,
    floor_no: Number,
    total_floors: Number,

    facing: {
      type: String,
      enum: ["east", "west", "north", "south", "north_east", "north_west", "south_east", "south_west"],
    },
    furnishing_status: {
      type: String,
      enum: ["unfurnished", "semi", "full"],
    },
    age_of_property: Number,

    address: String,
    locality: String,
    city: String,
    state: String,
    pincode: String,
    latitude: Number,
    longitude: Number,

    amenities: [{ type: String }], // ["parking","lift","gym","security"]

    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyOwner",
      required: true,
    },
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },

    rera_id: String,

    media: [
      {
        media_type: {
          type: String,
          enum: ["image", "video", "document"],
        },
        url: { type: String, required: true }, // location of the file (served path)
        file_name: { type: String }, // original file name as uploaded by the user
        file_size: { type: Number }, // size in bytes
        label: { type: String, trim: true, default: "" },
        source: {
          type: String,
          enum: ["property_form", "media_library"],
          index: true,
        },
        sort_order: { type: Number, default: 0 },
        uploaded_at: { type: Date, default: Date.now }, // when this exact file was stored
      },
    ],
  },
  { timestamps: true } // created_at, updated_at auto
);

// Compound index — every list/search query is tenant-scoped
propertySchema.index({ tenant_id: 1, status: 1 });
propertySchema.index({ tenant_id: 1, city: 1 });

module.exports = mongoose.model("Property", propertySchema);