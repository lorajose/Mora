# MORA family setup

## Page
Create a Shopify page named The MORA Family with handle mora-family. Assign template page.mora-family in the theme where it is available. If the theme is unpublished, preview that template through its editor before publishing. Add the page to navigation. Accounts must be enabled separately in Shopify settings.

## Proposed tiers
Use the store's currency. Confirm thresholds and refund treatment before displaying benefits.

VIP segment: amount_spent >= 500 OR number_of_orders >= 5
Insider segment: (amount_spent >= 150 OR number_of_orders >= 2) AND amount_spent < 500 AND number_of_orders < 5
Member: all customers not meeting either threshold. Marketing consent is a separate property; customer records do not prove an activated legacy account.

For campaign recipients additionally require email_subscription_status = 'SUBSCRIBED'.

Segments update automatically. The family page reads customer tags, so tags must be synchronized using Flow or another verified process; creating a segment does not assign a tag.

Flow setup specification: inspect the available customer order and spend fields in Shopify. At a qualifying paid order, reevaluate VIP first. Assign MORA_VIP and remove MORA_INSIDER; otherwise reevaluate Insider, assign MORA_INSIDER and remove MORA_VIP; otherwise remove both tags. Configure refund/cancellation reevaluation and a periodic reconciliation so existing customers and refunds do not leave stale tags. Verify what Shopify counts in number_of_orders rather than promising it represents only paid non-refunded purchases.

Test: fresh account, just below each threshold, exactly at each threshold, crossing from Insider to VIP, refund dropping spend, canceled order, existing customers, unsubscribed VIP. Confirm tags and segments agree before enabling program descriptions in MORA family page.

## Early access
Do not implement authorization solely through Liquid or CSS. Configure product/cart/checkout restrictions and test each enabled sales channel before promising reserved purchasing. Page tier display is informational only.

## Current implementation
Theme signup and customer account entry were verified by the store owner. Family tier page has not been verified in Shopify. Flow, tier tags, VIP discounts and purchase restrictions are not yet configured by this repository.
