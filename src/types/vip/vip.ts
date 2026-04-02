export enum VIP_TIERS_TYPE {
  BRONZE = 'Bronze',
  SILVER = 'Silver',
  GOLD = 'Gold',
  PLATINUM = 'Platinum',
  DIAMOND = 'Diamond',
  VIP = 'VIP',
}

// This is just for initial seed
export const VIP_TIERS = {
  [VIP_TIERS_TYPE.BRONZE]: {
    name: VIP_TIERS_TYPE.BRONZE,
    icon: 'https://s3.us-east-1.amazonaws.com/bitstake.images/uploads/97258f97-d473-4e72-b5d8-3d041892a552.jpg',
    minWager: 0,
    minGGR: 0,
    downgradePeriod: 0,
  },

  [VIP_TIERS_TYPE.SILVER]: {
    name: VIP_TIERS_TYPE.SILVER,
    icon: 'https://s3.us-east-1.amazonaws.com/bitstake.images/uploads/f384e5f1-fc39-4bb9-adcc-2d41a2702c35.jpg',
    minWager: 10000,
    minGGR: 0,
    downgradePeriod: 0,
  },

  [VIP_TIERS_TYPE.GOLD]: {
    name: VIP_TIERS_TYPE.GOLD,
    icon: 'https://s3.us-east-1.amazonaws.com/bitstake.images/uploads/a459fd58-c472-48a6-acac-c0dfc297fd3f.jpg',
    minWager: 100000,
    minGGR: 0,
    downgradePeriod: 0,
  },

  [VIP_TIERS_TYPE.PLATINUM]: {
    name: VIP_TIERS_TYPE.PLATINUM,
    icon: 'https://s3.us-east-1.amazonaws.com/bitstake.images/uploads/217f65b3-dad8-4758-ae79-d7abefeae5d5.jpg',
    minWager: 500000,
    minGGR: 0,
    downgradePeriod: 0,
  },

  [VIP_TIERS_TYPE.DIAMOND]: {
    name: VIP_TIERS_TYPE.DIAMOND,
    icon: 'https://s3.us-east-1.amazonaws.com/bitstake.images/uploads/76099c82-7ebf-43cc-bd87-1b7724693739.jpg',
    minWager: 1500000,
    minGGR: 0,
    downgradePeriod: 0,
  },

  [VIP_TIERS_TYPE.VIP]: {
    name: VIP_TIERS_TYPE.VIP,
    icon: 'https://s3.us-east-1.amazonaws.com/bitstake.images/uploads/ead36b83-a0dd-4610-a79c-ca8add1343e0.jpg',
    minWager: 4000000,
    minGGR: 0,
    downgradePeriod: 0,
  },
};
