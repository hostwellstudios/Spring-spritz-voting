// Central in-memory state. All modules read from and mutate this object,
// then call Router.render() to sync the DOM.

const State = {
  phase:          'onboarding',
  resultsShared:  false,
  guestId:        null,
  guestName:      null,
  guestDrinkId:   null,  // null = non-competitor / taster only
  drinks:         [],
  myNotes:        {},    // { [drinkId]: { text: string, share: bool } }
  votesSubmitted: false,
  isAdmin:        false,
};
