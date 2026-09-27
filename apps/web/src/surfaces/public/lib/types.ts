export type PublicRate = {
  startsOn: string;
  endsOn: string;
  directNightlyPrice: number;
};

export type PublicBookingConfig = {
  settings: {
    minimumNights: number;
    heatedPoolWeeklyPrice: number;
    currency: string;
  };
  rates: PublicRate[];
};

export type BookingQuote = {
  nights: number;
  baseAmount: number;
  heatedPoolAmount: number;
  promoAmount: number;
  totalAmount: number;
  promoDiscountPercent: number;
  currency: string;
};

export type BookingFormValues = {
  fullName: string;
  email: string;
  phone: string;
  guestsCount: string;
  checkIn: string;
  checkOut: string;
  heatedPool: boolean;
  promoCode: string;
  message: string;
  privacyAccepted: boolean;
};
