// /* eslint-disable */

// const { default: Stripe } = require("stripe");
// const stripe = Stripe('pk_test_51RNuqf4gk6NtMvcghI70Y67Bfbds8gIwfBm0wuOUw7kAIWKdgYi4NXCG26IERU5WilZIguZmLVO0mRLkgoel6AHe00dT5VapbS')

import axios from 'axios';
import { showAlert } from './alerts';
const stripe = Stripe(
  'pk_test_51RNuqf4gk6NtMvcghI70Y67Bfbds8gIwfBm0wuOUw7kAIWKdgYi4NXCG26IERU5WilZIguZmLVO0mRLkgoel6AHe00dT5VapbS',
);

export const bookTour = async (tourId) => {
  try {
    //* 1) Get checkout session form API
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`,
    );
    console.log(session);

    //* 2) Create checkout form + change credit card}
    await stripe.redirectToCheckout({ sessionId: session.data.session.id });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
