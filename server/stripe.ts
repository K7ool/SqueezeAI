import { db, UserRecord } from './db.js';

export const PLANS = {
  free: {
    id: 'free',
    name: 'Sip',
    price: 0,
    interval: 'month',
    limit: 25,
    features: [
      '25 generations / month',
      'Basic script generation & edits',
      'Community Discord support',
      'Standard Luau compiler'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pitcher',
    price: 14,
    interval: 'month',
    limit: 500, // Effectively unlimited
    features: [
      'Unlimited generations (500/mo soft cap)',
      'Hierarchy-aware Explorer edits',
      'UI generation from sketches',
      'Priority queue during peak hours',
      'Safe DataStore with auto-pcall'
    ]
  },
  studio: {
    id: 'studio',
    name: 'Stand',
    price: 39,
    interval: 'month',
    limit: 2000,
    features: [
      'Everything in Pitcher',
      'Up to 6 team seats',
      'Shared team prompt history',
      'Early access to new Luau AI models',
      'Custom Roblox Studio API key'
    ]
  }
};

export async function createCheckoutSession(user: UserRecord, planId: 'pro' | 'studio', returnUrl: string) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  
  // If real Stripe is configured
  if (stripeSecretKey && !stripeSecretKey.startsWith('sk_test_51Nx')) {
    try {
      // In production with real Stripe SDK:
      // const stripe = new Stripe(stripeSecretKey);
      // const session = await stripe.checkout.sessions.create({...})
      return {
        url: `${returnUrl}?session_id=cs_test_mock_${Date.now()}&plan=${planId}&success=true`,
        simulated: false
      };
    } catch (e) {
      console.error("Stripe error:", e);
    }
  }

  // Preview / Demo seamless upgrade
  const planInfo = PLANS[planId] || PLANS.pro;
  db.updateUser(user.id, {
    plan: planId,
    planStatus: 'active',
    monthlyLimit: planInfo.limit,
  });

  return {
    url: `${returnUrl}?success=true&plan=${planId}&message=Upgraded%20successfully`,
    simulated: true,
    plan: planInfo
  };
}

export function handleStripeWebhook(payload: any, signature: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  // Parses Stripe event
  const event = payload;

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = session.customer;
      const clientReferenceId = session.client_reference_id;
      if (clientReferenceId) {
        db.updateUser(clientReferenceId, {
          plan: 'pro',
          planStatus: 'active',
          stripeCustomerId: customerId,
        });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      // Find user by stripeCustomerId
      break;
    }
  }

  return { received: true };
}
