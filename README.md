# BitStake Backend

# 📚 Node.js/Express File Naming Conventions

This guide outlines the file and folder naming conventions for our **iGaming Betting Platform** built using **Node.js** and **Express**. Following these conventions ensures a clean, consistent, and scalable codebase.

---

## 🔥 Recommended File Naming Conventions

We use a combination of `kebab-case` and `PascalCase` for different types of files to maintain clarity and consistency.

| Type             | Convention | Example                                     |
| ---------------- | ---------- | ------------------------------------------- |
| **Config Files** | kebab-case | `db-config.js`, `server-config.js`          |
| **Routes**       | kebab-case | `user-routes.js`, `betting-routes.js`       |
| **Controllers**  | PascalCase | `UserController.js`, `BettingController.js` |
| **Models**       | PascalCase | `UserModel.js`, `BetModel.js`               |
| **Utilities**    | kebab-case | `format-date.js`, `calculate-odds.js`       |
| **Middleware**   | kebab-case | `auth-middleware.js`, `error-handler.js`    |
| **Entry Point**  | lowercase  | `server.js`, `app.js`                       |

---

## ✅ Best Practices

1. **Be Consistent:** Stick to the naming convention throughout the project.
2. **Use PascalCase for Classes:** Models and controllers should use PascalCase since they often represent objects or classes.
3. **Stick with kebab-case for Files:** Helps prevent issues on UNIX-based systems.
4. **Directory Names:** Should also use `kebab-case` (e.g., `controllers`, `routes`, `models`).

## 🛠️ Backend Initialization Steps

Follow these steps to initialize the backend environment properly:

1. **Seed Admin Panel Data**

   ```bash
   npm run seed
   ```

2. **Configure via Admin Panel**
   - Create **Loyalty Tiers**
   - Set up **Bonuses**
   - Define **Cashback Rules**

3. **Seed Main Backend**

   ```bash
   npm run seed
   ```

> ⚠️ Ensure all admin configurations are completed before running the main backend seed.
