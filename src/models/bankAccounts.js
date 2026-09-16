const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  tenant_of:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  tenant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RentalTenant',
    required: true,
  },
  bank_name: {
    type: String,
    required: true,
    trim: true
  },
  branch: {
    type: String,
    required: true,
    trim: true
  },
  ifsc_code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    length: 11
  },
  account_number: {
    type: String,
    required: true,
    trim: true
  },
  account_holder_name: {
    type: String,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('BankAccount', bankAccountSchema);