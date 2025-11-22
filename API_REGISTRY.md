# ServiceText Pro API Registry

This document lists all existing API endpoints to avoid duplication and ensure consistency.

## Authentication (`/api/v1/auth`)
*   Managed by: `authController`
*   (Routes assumed based on standard auth patterns, need verification if adding new auth)
*   `PUT /api/v1/auth/profile` - Update user profile.

## Verification (`/api/v1/verification`)
*   Managed by: `smsVerificationController`

## GDPR (`/api/v1/gdpr`)
*   Managed by: `gdprController`
*   `GET /api/v1/gdpr/privacy-notice` - Get privacy policy URLs and retention info.

## Messaging (`/api/v1/messaging`)
*   Managed by: `messagingController`

## Admin (`/api/v1/admin`)
*   Managed by: `adminController`

## Subscriptions (`/api/v1/subscriptions`)
*   Managed by: `subscriptionController`

## Points (`/api/v1/points`)
*   Managed by: `pointsController`

## Bidding (`/api/v1/bidding`)
*   Managed by: `biddingController`
*   `GET /case/:caseId/can-bid` - Check eligibility.
*   `POST /case/:caseId/bid` - Place a bid.
*   `GET /case/:caseId/bids` - List bids.
*   `POST /case/:caseId/select-winner` - Customer selects winner.
*   `GET /my-bids` - SP sees their bids.
*   `DELETE /bid/:bidId` - Cancel bid.

## Marketplace / Marketplace Controller
*   `GET /api/v1/marketplace/providers/search`
*   `GET /api/v1/marketplace/providers/:id`
*   `POST /api/v1/marketplace/providers/profile`
*   `GET /api/v1/marketplace/categories`
*   `GET /api/v1/marketplace/locations/cities`
*   `GET /api/v1/marketplace/locations/neighborhoods`
*   `POST /api/v1/marketplace/inquiries`
*   `GET /api/v1/marketplace/inquiries`
*   `POST /api/v1/marketplace/reviews`
*   `POST /api/v1/marketplace/conversations/:conversationId/messages`
*   `PUT /api/v1/marketplace/conversations/:conversationId`

## Chat V2 (`/api/v1/chat`)
*   Managed by: `chatControllerV2`
*   `GET /conversations`
*   `POST /conversations`
*   `GET /conversations/:id`
*   `GET /conversations/:id/messages`
*   `POST /conversations/:id/messages`
*   `POST /conversations/:id/read`
*   `PATCH /messages/:id`
*   `DELETE /messages/:id`
*   `POST /messages/:id/receipts`
*   `GET /messages/:id/receipts`

## Device Tokens (`/api/v1/device-tokens`)
*   Managed by: `deviceTokenController`
*   `POST /register`
*   `DELETE /:tokenId`
*   `GET /`
*   `POST /test`

## Tracking (`/api/v1/tracking`)
*   Managed by: `trackingController`
*   `POST /update` - Update provider location (GPS). Payload: `{ caseId?, latitude, longitude, heading, speed }`.
*   `GET /case/:caseId` - Get latest tracking info for a case.

## Referrals (`/api/v1/referrals`)
*   Managed by: `referralController`
*   `GET /code`
*   `GET /dashboard`
*   `GET /aggregate-progress`
*   `POST /track/:profileId`
*   `POST /create`
*   `POST /activate`
*   `GET /rewards`
*   `POST /rewards/:rewardId/apply`
*   `POST /generate-claim-token`
*   `GET /claim-sms/:token`
*   `GET /validate/:code`

## Cases (`/api/v1/cases`)
*   Managed by: `caseController`
*   `POST /` - Create case.
*   `GET /` - Get cases with filters.
*   `GET /stats`
*   `GET /stats/chat-source`
*   `GET /provider/:providerId`
*   `GET /queue/:providerId` - Get available cases (Open or Assigned).
*   `GET /:caseId`
*   `GET /:caseId/smart-matches`
*   `POST /:caseId/decline`
*   `POST /:caseId/accept`
*   `POST /:caseId/complete`
*   `PUT /:caseId/status`
*   `POST /:caseId/auto-assign`
*   `POST /:caseId/cancel`
*   `GET /declined/:providerId`
*   `POST /:caseId/undecline`

## Income (`/api/v1/income`)
*   Managed by: `caseController`
*   `GET /provider/:providerId`
*   `GET /provider/:providerId/years`
*   `GET /provider/:providerId/method/:paymentMethod`
*   `GET /provider/:providerId/month/:month`
*   `PUT /:incomeId`

## Notifications (`/api/v1/notifications`)
*   Managed by: `notificationController`
*   `GET /`
*   `GET /unread-count`
*   `POST /:notificationId/read`
*   `POST /mark-all-read`
*   `POST /test`

## Reviews (`/api/v1/reviews`)
*   Managed by: `reviewController`
*   `POST /`
*   `GET /provider/:providerId`
*   `GET /provider/:providerId/stats`
*   `POST /provider/:providerId/update-rating`
*   `GET /case/:caseId/can-review`
*   `GET /pending`
*   `POST /request`

## SMS (`/api/v1/sms`)
*   Managed by: `smsController`

## Provider Categories (`/api/v1/provider/categories`)
*   `GET /`
*   `POST /`
*   `PUT /`
*   `DELETE /:categoryId`

## Misc
*   `GET /health`
*   `GET /api/v1/health`
*   `GET /api/v1/dashboard/stats`
*   `GET /api/v1/app/version`
*   `POST /api/v1/uploads/image`
*   `POST /api/v1/sync/missed-calls`
*   `GET /api/v1/missed-calls`
*   `POST /api/v1/sync/sms-sent`
*   `GET /api/v1/status`
