require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const existingAdmin = await Admin.findOne({ email: 'superadmin@example.com' });
    if (existingAdmin) {
      console.log('Super admin already exists');
      return;
    }

    const superAdmin = new Admin({
      email: 'superadmin@example.com',
      password: 'superSecurePassword123!',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'superadmin',
    });

    await superAdmin.save();
    console.log('Super admin created successfully');
  } catch (error) {
    console.log('Error creating super admin:', error);
  } finally {
    mongoose.disconnect();
  }
};

seedAdmin();