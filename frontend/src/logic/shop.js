/**
 * shop.js — Item definitions and purchase logic.
 *
 * Extracted from templates/index.html:
 *   buyItem() (lines 1699-1710 and the authoritative version 1969-1983),
 *   SHOP_ITEMS (inferred from HTML markup and applyInventoryState()).
 *
 * NO DOM access. NO localStorage access.
 * All functions are pure: input state → return result.
 *
 * NOTE: buyItem() was defined TWICE in the original file. The second
 * definition (lines 1969-1983) overwrites the first at runtime. The second
 * version is therefore the authoritative one and is what this module
 * implements. The difference is minor:
 *   First  version: "Not enough Coins! You need {cost - coins} more 🪙."
 *   Second version: "Not enough coins! You need {cost} 🪙"
 * The second version (authoritative) is preserved here.
 */

// ---------------------------------------------------------------------------
// Item catalogue (derived from HTML shop markup — lines 402-425)
// ---------------------------------------------------------------------------

/**
 * All purchasable shop items.
 * Prices are copied from the onclick handlers in the original HTML.
 */
export const SHOP_ITEMS = [
  { id: 'theme_cyberpunk', name: 'Theme: Cyberpunk', desc: 'Unlock retro neon styling.',      cost: 500, category: 'theme' },
  { id: 'theme_gameboy',   name: 'Theme: Gameboy',   desc: 'Classic green monochrome.',        cost: 500, category: 'theme' },
  { id: 'music_lofi',      name: 'Music: Lofi Beats', desc: 'Alternative study track.',        cost: 300, category: 'music' },
];

// ---------------------------------------------------------------------------
// Purchase logic
// ---------------------------------------------------------------------------

/**
 * Result shape returned by attemptPurchase.
 * @typedef {Object} PurchaseResult
 * @property {boolean} success
 * @property {string}  reason    - 'ok' | 'already_owned' | 'insufficient_coins'
 * @property {number}  coins     - updated coin balance
 * @property {string[]} inventory - updated inventory array
 */

/**
 * Attempt to purchase an item.
 *
 * Mirrors the authoritative buyItem() from index.html (lines 1969-1983).
 *
 * Rules (preserved exactly):
 *   - If item is already in inventory → reject with 'already_owned'.
 *   - If coins < cost               → reject with 'insufficient_coins'.
 *   - Otherwise                     → deduct coins, add itemId to inventory.
 *
 * @param {string}   itemId
 * @param {number}   cost
 * @param {number}   coins
 * @param {string[]} inventory
 * @returns {PurchaseResult}
 */
export function attemptPurchase(itemId, cost, coins, inventory) {
  if (inventory.includes(itemId)) {
    return { success: false, reason: 'already_owned', coins, inventory };
  }
  if (coins < cost) {
    return { success: false, reason: 'insufficient_coins', coins, inventory };
  }
  return {
    success: true,
    reason:  'ok',
    coins:   coins - cost,
    inventory: [...inventory, itemId],
  };
}

/**
 * Check whether an item is already owned.
 *
 * @param {string}   itemId
 * @param {string[]} inventory
 * @returns {boolean}
 */
export function isOwned(itemId, inventory) {
  return inventory.includes(itemId);
}

/**
 * Look up a shop item by id.
 *
 * @param {string} itemId
 * @returns {{ id: string, name: string, desc: string, cost: number, category: string } | undefined}
 */
export function getShopItem(itemId) {
  return SHOP_ITEMS.find(i => i.id === itemId);
}
