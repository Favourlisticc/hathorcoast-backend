const Agent = require('../models/Agent');
const Property = require('../models/Property');
const Commission = require('../models/Commission');
const Tenant = require('../models/Tenant');

class AgentStatsService {
  static async getSalesRevenue(agentId) {
    try {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get all commissions for the agent
      const commissions = await Commission.find({
        agent: agentId,
        createdAt: { $exists: true }
      });

      // Calculate total revenue
      const total = commissions.reduce((sum, commission) => sum + commission.amount, 0);

      // Calculate monthly revenue
      const monthlyCommissions = commissions.filter(
        commission => commission.createdAt >= firstDayOfMonth
      );
      const monthly = monthlyCommissions.reduce((sum, commission) => sum + commission.amount, 0);

      // Calculate weekly revenue
      const weeklyCommissions = commissions.filter(
        commission => commission.createdAt >= lastWeek
      );
      const weekly = weeklyCommissions.reduce((sum, commission) => sum + commission.amount, 0);

      // Calculate growth (comparing current month to previous month)
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthCommissions = commissions.filter(
        commission => commission.createdAt >= lastMonth && commission.createdAt < firstDayOfMonth
      );
      const lastMonthTotal = lastMonthCommissions.reduce((sum, commission) => sum + commission.amount, 0);
      
      const growth = lastMonthTotal > 0 
        ? ((monthly - lastMonthTotal) / lastMonthTotal) * 100 
        : 0;

      // Set target as 30% more than last month's revenue
      const target = Math.max(lastMonthTotal * 1.3, 200000);
      const progressPercentage = (total / target) * 100;

      return {
        total,
        weekly,
        monthly,
        growth,
        target,
        progressPercentage
      };
    } catch (error) {
      throw error;
    }
  }

  static async getClientStats(agentId) {
    try {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Get all properties managed by the agent
      const properties = await Property.find({ agent: agentId });
      const propertyIds = properties.map(property => property._id);

      // Get all tenants for these properties
      const tenants = await Tenant.find({
        property: { $in: propertyIds }
      });

      // Calculate active tenants (those with active leases)
      const activeTenantsCount = tenants.filter(tenant => {
        const endDate = new Date(tenant.endDate);
        return endDate >= today;
      }).length;

      // Calculate new tenants this month
      const newTenantsCount = tenants.filter(tenant => {
        const startDate = new Date(tenant.startDate);
        return startDate >= firstDayOfMonth;
      }).length;

      // Calculate churned tenants this month
      const churnedTenantsCount = tenants.filter(tenant => {
        const endDate = new Date(tenant.endDate);
        return endDate >= firstDayOfMonth && endDate <= today;
      }).length;

      return {
        total: tenants.length,
        active: activeTenantsCount,
        percentage: (activeTenantsCount / tenants.length) * 100 || 0,
        newThisMonth: newTenantsCount,
        churnedThisMonth: churnedTenantsCount
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AgentStatsService; 