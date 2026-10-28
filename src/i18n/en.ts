/**
 * All English UI text. Add Hindi later as hi.ts with the same shape.
 * Placeholders like {name} are filled by format() in ./index.ts.
 * Use plain words — the people using this app may never have used software like it.
 */
export const en = {
  app: {
    name: "Inventory",
    tagline: "Stock, customers and orders",
  },

  nav: {
    home: "Home",
    items: "Items",
    addStock: "Add Stock",
    newOrder: "New Order",
    orders: "Orders",
    customers: "Customers",
    users: "Staff & Logins",
    more: "More",
    logout: "Log out",
    menu: "Menu",
    mainNavigation: "Main navigation",
    skipToContent: "Skip to main content",
    loggedInAs: "Logged in as {name}",
  },

  common: {
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    back: "Back",
    edit: "Edit",
    loading: "Loading…",
    yes: "Yes",
    no: "No",
    optional: "optional",
    comingSoon: "Coming soon",
    comingSoonBody: "This screen is being built and will be ready in the next update.",
    goHome: "Go to Home",
    showPassword: "Show password",
    hidePassword: "Hide password",
    clearSearch: "Clear search",
    somethingWrong: "Something went wrong",
    somethingWrongBody:
      "Please try again. If it keeps happening, check your internet connection or tell the owner.",
    tryAgain: "Try again",
    notFound: "Page not found",
    notFoundBody: "This page does not exist. It may have been moved.",
  },

  roles: {
    ADMIN: "Owner (Admin)",
    STAFF: "Staff",
  },

  auth: {
    loginTitle: "Log in",
    loginSubtitle: "Enter your username and password.",
    identifier: "Username or email",
    identifierHint: "Staff: your username, e.g. ramesh. Owner: your email.",
    password: "Password",
    loginButton: "Log in",
    loggingIn: "Logging in…",
    forgotPasswordLink: "Forgot password?",
    wrongPassword: "Wrong username or password. Check the spelling and try again.",
    accountInactive: "This login has been turned off. Please ask the owner.",
    loginFailed: "Could not log in right now. Check your internet and try again.",
    loggedOut: "You have been logged out.",
    sessionEnded: "Your login was turned off by the owner. Please ask them for help.",

    forgotTitle: "Forgot password",
    forgotSubtitle:
      "Owner: enter your email and we will send you a link to set a new password. Staff: please ask the owner to reset your password.",
    email: "Email",
    sendResetLink: "Send reset link",
    sending: "Sending…",
    resetLinkSent:
      "If that email has a login, a reset link is on its way. Open it on this same phone or computer.",
    backToLogin: "Back to log in",

    resetTitle: "Set a new password",
    resetSubtitle: "Choose a new password you will remember.",
    newPassword: "New password",
    confirmPassword: "Type the new password again",
    savePassword: "Save new password",
    passwordSaved: "Your new password is saved.",
    resetLinkInvalid:
      "This reset link has expired or was opened in a different browser. Please ask for a new link.",
  },

  home: {
    greeting: "Namaste, {name}",
    subtitle: "What would you like to do?",
    quickActions: "Quick actions",
    newOrderHint: "Sell to a customer",
    addStockHint: "Goods arrived in the godown",
    itemsHint: "See stock and prices",
    customersHint: "Shops you sell to",
    ordersHint: "Past orders",
    usersHint: "Add or turn off staff logins",
    denied: "Only the owner can open that page.",
  },

  users: {
    title: "Staff & Logins",
    subtitle: "Create logins for your staff, change roles, or turn a login off.",
    add: "Add staff login",
    addTitle: "New staff login",
    addSubtitle: "Your staff will log in with this username and password.",
    editTitle: "Edit login",
    searchPlaceholder: "Search by name or username",
    fullName: "Full name",
    fullNamePlaceholder: "e.g. Ramesh Kumar",
    username: "Username",
    usernameHint: "Small letters and numbers only, e.g. ramesh. Used to log in.",
    role: "Role",
    roleHint: "Staff cannot manage logins, change item prices or archive records.",
    password: "Password",
    passwordHint: "At least 8 characters. Tell this to the staff member.",
    status: "Status",
    active: "Active",
    inactive: "Turned off",
    you: "You",
    created: "Login created for {name}. Share the username and password with them.",
    updated: "Changes saved.",
    usernameTaken: "This username is already used. Try another, e.g. {suggestion}.",
    empty: "No staff logins yet",
    emptyBody: "Add a login for each person who will use the app.",
    noResults: "No one matches “{query}”",
    noResultsBody: "Check the spelling, or clear the search.",

    deactivate: "Turn off login",
    deactivateTitle: "Turn off {name}'s login?",
    deactivateBody:
      "{name} will be logged out and will not be able to log in. Their past work stays saved. You can turn it back on later.",
    deactivated: "{name}'s login is turned off.",
    reactivate: "Turn login back on",
    reactivated: "{name} can log in again.",
    reactivateBody: "{name} will be able to log in again with their old password.",
    cannotChangeSelf: "You cannot turn off or change the role of your own login.",
    selfRoleNote: "You cannot change your own role.",
    usernameFixed: "The username cannot be changed after the login is created.",
    roleStaffHint: "Can add items, add stock and make orders.",
    roleAdminHint: "Can do everything, including managing logins, prices and archiving.",

    resetPassword: "Reset password",
    resetPasswordTitle: "Set a new password for {name}",
    resetPasswordBody: "Type a new password, then tell it to {name}.",
    passwordReset: "New password saved for {name}.",
  },

  validation: {
    required: "Please fill this in.",
    tooLong: "This is too long.",
    usernameFormat:
      "Use 3–30 small letters, numbers, dots, dashes or underscores. Start with a letter or number.",
    passwordTooShort: "Password must be at least 8 characters.",
    passwordsDontMatch: "The two passwords are not the same.",
    email: "Enter a valid email, e.g. name@example.com.",
    invalidChoice: "Please choose one of the options.",
    fixErrors: "Please fix the highlighted fields.",
  },

  errors: {
    adminOnly: "Only the owner can do this.",
    notFound: "We could not find that. It may have been removed.",
    generic: "Something went wrong. Please try again.",
  },

  confirm: {
    areYouSure: "Are you sure?",
    yesContinue: "Yes, continue",
    noGoBack: "No, go back",
  },
} as const;
