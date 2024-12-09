const express = require('express');
const env = require('dotenv')
const cors = require('cors');
const app = express();
const http = require('http').Server(app);

env.config()
const PORT = process.env.PORT || 4000;

// Connect to Database
const connectDB = require('./config/db');
connectDB();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
// CORS Configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://hathor-coast-frontend-ztas.vercel.app'], // No trailing slash
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Access-Control-Allow-Credentials'
  ]
}));


const initializeCounters = require('./utils/initCounters');

// Initialize counters
initializeCounters().catch(console.error);

// Routes
app.use('/landlord', require('./routes/landlord/registration'));
app.use('/properties', require('./routes/landlord/properties'));
app.use('/tenant', require('./routes/tenant/registration'));
app.use('/payments', require('./routes/tenant/payments'));
app.use('/lease', require('./routes/landlord/leases'));
app.use('/admin', require('./routes/admin/auth'));
app.use('/evictions', require('./routes/landlord/evictions'));
app.use('/tenants', require('./routes/tenant/main'));
app.use('/referrals', require('./routes/tenant/referrals'));
app.use('/agents', require('./routes/agents/auth'));
app.use('/tickets', require('./routes/tickets/tickets'));
app.use('/conversations', require('./routes/messages/conversations'));
app.use('/notifications', require('./routes/messages/notifications'));
app.use('/users', require('./routes/messages/users'));
app.use('/admin/reports', require('./routes/admin/reports'));
app.use('/admin/settings', require('./routes/admin/settings'));
app.use('/admin/support', require('./routes/admin/support'));
app.use('/admin/properties', require('./routes/admin/properties'));
app.use('/admin/tenants', require('./routes/admin/tenants'));
app.use('/admin/landlords', require('./routes/admin/landlords'));
app.use('/admin/utilities', require('./routes/utilities/utilities'));
app.use('/admin/agents', require('./routes/admin/agents'));
app.use('/admin/invoices', require('./routes/admin/invoices'));
app.use('/agents', require('./routes/agents/agent'));
app.use('/agents/withdrawal', require('./routes/agents/withdrawal'));
app.use('/admin/withdrawal', require('./routes/admin/withdrawal'));
app.use('/agents/stats', require('./routes/agents/stats'));
app.use('/admin/tasks', require('./routes/admin/tasks'));
app.use('/agents/rankings', require('./routes/agents/rankings'));
app.use('/admin/ads', require('./routes/admin/ads'));
app.use('/admin/rankings', require('./routes/admin/rankings'));
app.use('/agents/tasks', require('./routes/agents/tasks'));
app.use('/public/ads', require('./routes/public/ads'));
app.use('/referrals', require('./routes/referrals/referrals'));
app.use('/content', require('./routes/public/content'));
app.use('/units', require('./routes/landlord/units'));
app.use('/admin/units', require('./routes/admin/unit-price'));
app.use('/admin/units', require('./routes/admin/units'));
app.use('/payment', require('./routes/payment/index'));
app.use('/kyc', require('./routes/kyc/kyc'));
app.use('/admin/management', require('./routes/admin/admin'));

http.listen(PORT, () => {
  console.log(`Server connected on ${PORT}`);
})