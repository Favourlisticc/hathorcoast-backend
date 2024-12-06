const rankingTiers = [
  {
    name: 'Diamond',
    minimumEarnings: 10000000, // 10M
    bonus: 15, // 15% bonus
  },
  {
    name: 'Platinum',
    minimumEarnings: 5000000, // 5M
    bonus: 10, // 10% bonus
  },
  {
    name: 'Gold',
    minimumEarnings: 2000000, // 2M
    bonus: 7.5, // 7.5% bonus
  },
  {
    name: 'Silver',
    minimumEarnings: 1000000, // 1M
    bonus: 5, // 5% bonus
  },
  {
    name: 'Bronze',
    minimumEarnings: 500000, // 500K
    bonus: 2.5, // 2.5% bonus
  }
];

module.exports = rankingTiers; 