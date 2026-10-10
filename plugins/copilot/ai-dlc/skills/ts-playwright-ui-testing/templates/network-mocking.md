# network-mocking

End-to-end tests run against the real back end. Which requests may be routed is decided by `test-doubles`: a third-party service the test environment cannot reach or must not charge (an unowned boundary), or a failure of your own API that cannot be produced for real (an unproducible failure). The patterns below are the mechanics.

**Fulfil a request with a fixed response:**

```ts
await page.route('**/api.payments.example.com/v1/charges', (route) =>
  route.fulfill({ status: 402, json: { error: 'card_declined' } }),
);
```

**Modify a real third-party response** (an empty list the provider's sandbox cannot be made to return):

```ts
await page.route('**/api.reviews.example.com/v1/reviews**', async (route) => {
  const response = await route.fetch();
  const body = await response.json();
  await route.fulfill({ response, json: { ...body, items: [] } });
});
```

**Replay recorded traffic from a HAR file:**

```ts
await page.routeFromHAR('e2e/hars/maps.har', { url: '**/maps.example.com/**', update: false });
```

Record or refresh with `update: true`, review the HAR (it can contain tokens), then commit it.

- Register routes **before** the navigation that triggers the request.
- Match the narrowest URL pattern (and method) possible, and `route.fallback()` everything else to the real server.
- A route on your own API carries the Arrange comment `test-doubles` requires (the failure, and why it cannot be produced for real) and sits in its own `describe`; `complete-example.md` [AC-3] shows the form.
- Assert on what the user sees after the routed response.
