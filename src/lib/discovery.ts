// Discovery hygiene: test/demo accounts (@snivat.local, @snivat.test)
// never surface in discovery lists (Who to follow, Top voices, People
// directory). Their posts stay visible and their profiles stay visitable
// — only the promotion slots hide them. Owner + official accounts use
// real emails and are unaffected.

const TEST_DOMAINS = ["@snivat.local", "@snivat.test"];

/** Prisma `where` fragment excluding test-domain accounts. Spread into
 *  discovery queries: `where: { ..., ...excludeTestAccounts }`. */
export const excludeTestAccounts = {
  AND: TEST_DOMAINS.map((d) => ({ email: { not: { endsWith: d } } })),
};
