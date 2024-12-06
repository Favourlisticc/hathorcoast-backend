const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    mongoose.set('strictQuery', false);

    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Database Connected!`)
  } catch (error) {
    console.log(error)
  }
}

module.exports = connectDB;