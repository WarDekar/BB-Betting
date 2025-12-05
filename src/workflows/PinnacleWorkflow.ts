import { BaseSiteWorkflow } from './BaseSiteWorkflow.js';
import type { BrowserManager } from '../core/BrowserManager.js';
import type { SiteConfig, WorkflowResult } from '../types/index.js';

/**
 * Bet history item from Pinnacle/probet42
 */
export interface PinnacleBetHistoryItem {
  /** Unique bet ID from Pinnacle */
  betId: string;
  /** Date/time bet was placed */
  placedAt: Date;
  /** Date/time bet was settled (if settled) */
  settledAt?: Date;
  /** Sport (e.g., "Soccer", "Basketball") */
  sport: string;
  /** League/competition */
  league: string;
  /** Event description (teams/players) */
  event: string;
  /** Bet type (e.g., "Moneyline", "Spread", "Total") */
  betType: string;
  /** Selection made */
  selection: string;
  /** Odds at time of bet (decimal) */
  odds: number;
  /** Stake amount */
  stake: number;
  /** Currency */
  currency: string;
  /** Potential win amount */
  potentialWin: number;
  /** Actual win/loss (if settled) */
  result?: number;
  /** Bet status */
  status: 'pending' | 'won' | 'lost' | 'void' | 'cashout';
}

/**
 * Pinnacle workflow for probet42 mirror site.
 *
 * Site structure (as of Dec 2024):
 * - Login: Header fields (Username, Password) + "SIGN IN" button
 * - Logged in: Login fields replaced with account info/balance
 * - Bet history: TBD - need to explore once logged in
 */
export class PinnacleWorkflow extends BaseSiteWorkflow {
  // Default base URL for probet42 (Pinnacle mirror)
  static readonly DEFAULT_URL = 'https://probet42.com';

  constructor(config: SiteConfig, manager: BrowserManager) {
    super(
      {
        ...config,
        baseUrl: config.baseUrl || PinnacleWorkflow.DEFAULT_URL,
      },
      manager
    );
  }

  /**
   * Check if user is logged in.
   *
   * When NOT logged in:
   * - Username/Password input fields visible in header
   * - "SIGN IN" button present
   *
   * When logged in:
   * - Login fields are gone
   * - Account balance or username displayed
   */
  async isLoggedIn(): Promise<boolean> {
    const page = this.getPage();

    // Check for logged-OUT indicators (if these exist, NOT logged in)
    const hasSignInButton = await this.exists('button:has-text("SIGN IN")');
    const hasUsernameField = await this.exists('input[placeholder="Username"]');
    const hasPasswordField = await this.exists('input[type="password"]');

    // If login form elements are present, user is NOT logged in
    if (hasSignInButton || hasUsernameField || hasPasswordField) {
      return false;
    }

    // Additional check: look for logged-in indicators
    // These selectors may need adjustment after seeing logged-in state
    const hasAccountMenu = await this.exists('.account-menu, .user-menu, .balance');
    const hasLogoutOption = await this.exists('[data-action="logout"], .logout, a[href*="logout"]');

    return hasAccountMenu || hasLogoutOption;
  }

  /**
   * Login with credentials (auto-fill) or wait for manual login.
   *
   * If credentials are provided in config, attempts auto-fill.
   * Otherwise, falls back to base class manual login behavior.
   */
  async login(): Promise<WorkflowResult<void>> {
    const page = this.getPage();

    // Check if already logged in
    if (await this.isLoggedIn()) {
      return { success: true, timestamp: new Date() };
    }

    // If we have credentials, try auto-fill
    const username = (this.config as SiteConfig & { username?: string }).username;
    const password = (this.config as SiteConfig & { password?: string }).password;

    if (username && password) {
      try {
        console.log(`🔐 Attempting auto-login for ${this.config.name}...`);

        // Fill username - using #loginId selector for probet42
        await this.waitFor('#loginId', 5000);
        await this.type('#loginId', username);

        // Random delay to avoid rate limiting
        await this.randomDelay(1200, 2500);

        // Fill password - using #pass selector for probet42
        await this.type('#pass', password);

        // Random delay before clicking
        await this.randomDelay(800, 1800);

        // Click sign in
        await this.click('button:has-text("SIGN IN")');

        // Wait for login to complete (random delay)
        await this.randomDelay(2500, 4000);

        if (await this.isLoggedIn()) {
          console.log(`✅ Auto-login successful for ${this.config.name}`);
          await this.saveSession();
          return { success: true, timestamp: new Date() };
        } else {
          console.log(`⚠️ Auto-login may have failed, check for captcha or 2FA`);
        }
      } catch (err) {
        console.log(`⚠️ Auto-login error: ${(err as Error).message}`);
      }
    }

    // Fall back to manual login
    return super.login();
  }

  /**
   * Get bet history for a specific date or date range.
   *
   * TODO: Implement once logged in and bet history page is discovered.
   *
   * @param date - Specific date to get history for
   * @param endDate - Optional end date for range query
   */
  async getBetHistory(
    date?: Date,
    endDate?: Date
  ): Promise<WorkflowResult<PinnacleBetHistoryItem[]>> {
    try {
      const page = this.getPage();

      // Ensure we're logged in
      if (!(await this.isLoggedIn())) {
        return this.result(false, [], 'Not logged in. Call login() first.');
      }

      // TODO: Navigate to bet history page
      // The URL structure needs to be discovered by exploring the logged-in site
      // Common patterns:
      // - /account/history
      // - /my-bets
      // - /bet-history
      // - Account menu dropdown -> "Bet History" or "My Bets"

      console.log('⚠️ getBetHistory() not yet implemented - need to discover history page URL');
      console.log('   Please navigate to bet history manually and note the URL/selectors');

      // Placeholder: return empty array
      return this.result(true, [], 'Not implemented - need to discover history page');

    } catch (err) {
      return this.result(false, [], (err as Error).message);
    }
  }

  /**
   * Navigate to bet history page.
   * TODO: Implement once URL is discovered.
   */
  async navigateToBetHistory(): Promise<boolean> {
    // TODO: Implement navigation to bet history
    // This might involve:
    // 1. Clicking account menu
    // 2. Selecting "Bet History" or similar
    // 3. Or navigating directly to a URL

    console.log('⚠️ navigateToBetHistory() not yet implemented');
    return false;
  }

  /**
   * Get current account balance.
   * TODO: Implement once balance selector is discovered.
   */
  async getBalance(): Promise<WorkflowResult<{ balance: number; currency: string } | null>> {
    try {
      if (!(await this.isLoggedIn())) {
        return this.result(false, null, 'Not logged in');
      }

      // TODO: Find balance selector after logging in
      // Common patterns:
      // - .balance, .account-balance
      // - Element near username showing "$X,XXX.XX"

      console.log('⚠️ getBalance() not yet implemented - need to find balance selector');
      return this.result(true, null, 'Not implemented');

    } catch (err) {
      return this.result(false, null, (err as Error).message);
    }
  }

  /**
   * Take a screenshot of current page state.
   * Useful for debugging and discovering page structure.
   */
  async screenshot(filename?: string): Promise<Buffer> {
    const browser = this.getBrowser();
    const buffer = await browser.screenshot({ fullPage: false });

    if (filename) {
      const fs = await import('fs/promises');
      await fs.writeFile(filename, buffer);
      console.log(`📸 Screenshot saved: ${filename}`);
    }

    return buffer;
  }
}
