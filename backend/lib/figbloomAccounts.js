// People's Figbloom accounts, made through the platform (ERP/FLEET_COGNITO_CONTRACT.md
// section 2). With Figbloom sign-in on, Cognito holds web users' passwords:
// Fleet's sign-up and invitation forms still ask for one, and pass it here
// once; Fleet never stores it. Drivers (the app) keep Fleet's own password.
import { PlatformError, sharedPlatformClient } from "./platform/client.js";

// What a person reads when their password doesn't meet the Figbloom rule
// (the customers pool's policy, figbloom-platform users.ts).
export const FIGBLOOM_PASSWORD_RULE = "at least 12 characters, with an upper-case letter, a lower-case letter, a digit and a symbol";

// A refusal to show the person, or a failure to log: status and code are
// what Fleet answers with.
export class FigbloomAccountError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "FigbloomAccountError";
    this.status = status;
    this.code = code;
  }
}

const unavailable = () =>
  new FigbloomAccountError("Figbloom accounts can't be created right now. Please try again in a few minutes.", 503, "accounts_unavailable");

function translate(err) {
  if (err instanceof PlatformError) {
    if (err.code === "invalid_password") return new FigbloomAccountError(`Your password must be ${FIGBLOOM_PASSWORD_RULE}.`, 400, "invalid_password");
    if (err.code === "password_already_set") {
      return new FigbloomAccountError(
        'You already have a Figbloom password. To change it, use "Forgot password" on the Figbloom sign-in page.',
        409,
        "use_figbloom_reset"
      );
    }
    console.error(`[figbloom accounts] the platform refused (${err.status} ${err.code}): ${err.message}`);
    return unavailable();
  }
  return err;
}

// Tests swap these (like invitationMailer.send).
export const figbloomAccounts = {
  client: () => sharedPlatformClient(),

  /**
   * The Figbloom account for this email: { sub, created }. created: false
   * means the person already has one (from Fleet or another product); its
   * password is unchanged, and they must sign in with it.
   */
  async ensure({ email, name, password, emailProven = false }) {
    const client = this.client();
    if (!client) {
      console.error("[figbloom accounts] PLATFORM_* settings are missing");
      throw unavailable();
    }
    try {
      const body = { email, name, email_proven: emailProven, ...(password === undefined ? {} : { password }) };
      const { user_sub: sub, created } = await client.createUser(body);
      return { sub, created: !!created };
    } catch (err) {
      throw translate(err);
    }
  },

  // The first password of an account Fleet made without one.
  async setInitialPassword(sub, password) {
    const client = this.client();
    if (!client) throw unavailable();
    try {
      await client.setInitialPassword(sub, password);
    } catch (err) {
      throw translate(err);
    }
  },
};

export function sendAccountError(res, err) {
  return res.status(err.status).json({ code: err.code, error: err.message });
}
