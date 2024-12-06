const express = require('express');
const router = express.Router();
const Payment = require('../../models/Payment');
const Landlord = require('../../models/Landlord');
const Tenant = require('../../models/Tenant');
const Admin = require('../../models/Admin');
const Property = require('../../models/Property');
const { adminMiddleware } = require('../../middleware');

// Generate payment report
router.post('/payments', adminMiddleware, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    const payments = await Payment.find({
      date: {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      },
      status: 'Completed' // Only include completed payments
    })
    .populate('property', 'propertyName')
    .populate('tenant', 'firstName lastName')
    .populate('invoice', 'invoiceCode')
    .sort({ date: 'desc' });

    // Calculate totals by payment method
    const paymentMethodTotals = payments.reduce((acc, payment) => {
      acc[payment.paymentMethod] = (acc[payment.paymentMethod] || 0) + payment.amount;
      return acc;
    }, {});

    const total = payments.reduce((sum, payment) => sum + payment.amount, 0);

    res.json({
      success: true,
      payments: payments.map(payment => ({
        _id: payment._id,
        date: payment.date,
        property: {
          _id: payment.property._id,
          propertyName: payment.property.propertyName
        },
        tenant: {
          _id: payment.tenant._id,
          firstName: payment.tenant.firstName,
          lastName: payment.tenant.lastName
        },
        invoice: {
          _id: payment.invoice._id,
          invoiceCode: payment.invoice.invoiceCode
        },
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paymentReference: payment.paymentReference,
        status: payment.status
      })),
      summary: {
        total,
        paymentMethodTotals
      }
    });
  } catch (error) {
    console.error('Payment report error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error generating payment report', 
      error: error.message 
    });
  }
});

router.post('/properties', adminMiddleware, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const properties = await Property.aggregate([
      {
        $lookup: {
          from: 'propertytypes', // Add lookup to get property type name
          localField: 'propertyType',
          foreignField: '_id',
          as: 'propertyTypeDetails'
        }
      },
      {
        $unwind: {
          path: '$propertyTypeDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'payments',
          localField: '_id',
          foreignField: 'property',
          pipeline: [
            {
              $match: {
                date: {
                  $gte: new Date(fromDate),
                  $lte: new Date(toDate)
                }
              }
            }
          ],
          as: 'payments'
        }
      },
      {
        $lookup: {
          from: 'invoices',
          localField: '_id',
          foreignField: 'property',
          pipeline: [
            {
              $match: {
                dueDate: {
                  $lte: new Date(toDate)
                },
                status: 'Pending'
              }
            }
          ],
          as: 'pendingInvoices'
        }
      },
      {
        $addFields: {
          revenue: { $sum: '$payments.amount' },
          outstanding: { $sum: '$pendingInvoices.total' },
          occupancyRate: {
            $cond: [
              { $eq: ['$status', 'Occupied'] },
              1,
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: '$propertyType',
          propertyTypeName: { $first: '$propertyTypeDetails.name' }, // Add property type name
          properties: {
            $push: {
              _id: '$_id',
              propertyCode: '$propertyCode',
              propertyName: '$propertyName',
              status: '$status',
              revenue: '$revenue',
              outstanding: '$outstanding',
              occupancyRate: '$occupancyRate'
            }
          },
          totalRevenue: { $sum: '$revenue' },
          totalOutstanding: { $sum: '$outstanding' },
          occupiedCount: { $sum: '$occupancyRate' },
          totalCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 1,
          propertyTypeName: 1,
          properties: 1,
          totalRevenue: 1,
          totalOutstanding: 1,
          occupiedCount: 1,
          totalCount: 1,
          occupancyRate: {
            $multiply: [
              { $divide: ['$occupiedCount', '$totalCount'] },
              100
            ]
          }
        }
      },
      {
        $sort: {
          propertyTypeName: 1
        }
      }
    ]);

    // Calculate overall totals
    const totalRevenue = properties.reduce((sum, prop) => sum + prop.totalRevenue, 0);
    const totalOutstanding = properties.reduce((sum, prop) => sum + prop.totalOutstanding, 0);
    const totalProperties = properties.reduce((sum, prop) => sum + prop.totalCount, 0);
    const totalOccupied = properties.reduce((sum, prop) => sum + prop.occupiedCount, 0);
    const overallOccupancyRate = totalProperties > 0 
      ? ((totalOccupied / totalProperties) * 100).toFixed(2) 
      : 0;

    res.json({
      success: true,
      properties,
      summary: {
        totalRevenue,
        totalOutstanding,
        totalProperties,
        totalOccupied,
        overallOccupancyRate
      }
    });
  } catch (error) {
    console.error('Property report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating property report',
      error: error.message
    });
  }
});

// Get statistics counts
router.get('/statistics', adminMiddleware, async (req, res) => {
  try {
    // Aggregate counts from each collection
    const landlordsCount = await Landlord.countDocuments({});
    const tenantsCount = await Tenant.countDocuments({});
    const adminsCount = await Admin.countDocuments({});
    const propertiesCount = await Property.countDocuments({});

    res.json({
      success: true,
      statistics: {
        landlordsCount,
        tenantsCount,
        adminsCount,
        propertiesCount
      }
    });
  } catch (error) {
    console.error('Statistics report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

module.exports = router;
