Federated threadiverse example using Fedify and Next.js
=======================================================

> [!WARNING]
> This program is for educational purposes only.  Do not use it for any
> other purpose; it has not been tested for security or scale.

This is a small threadiverse-style community platform written against
[Fedify] (the ActivityPub server framework) and [Next.js] (the web
framework).  It pairs with the
[*Building a threadiverse community platform*][tutorial] tutorial on
fedify.dev—the commits in this repository correspond one-to-one with the
tutorial's sections so you can `git checkout` any commit and see the state of
the project at that step.

Features:

 -  Users can sign up and log in with a username + password.
 -  Local users are federated as `Person` actors with per-user key pairs.
 -  Local users can create communities, federated as `Group` actors with
    per-community key pairs, an inbox/outbox, and a followers collection.
 -  Users can follow and unfollow any threadiverse-compatible community
    (local or remote) using `Follow`/`Undo(Follow)`/`Accept(Follow)`.
 -  Users can post text threads (`Create(Page)`) and replies
    (`Create(Note)`).  Communities re-distribute everything they receive
    to their followers as `Announce`.
 -  Users can up-vote (`Like`) and down-vote (`Dislike`) threads and
    replies; the community re-announces those too.
 -  The home page is a subscribed feed of threads from every community
    the viewer follows.

As with any small educational example, many features of real
threadiverse servers (Lemmy, Mbin, NodeBB) are left out intentionally:

 -  No thread or reply editing or deletion
    (`Update(Page)`/`Delete(Page)`/`Update(Note)`/`Delete(Note)`/`Tombstone`).
 -  No link threads, just text threads.
 -  No moderation (mod roles, removals, bans, reports).
 -  No ranking algorithms (hot/active/scaled), just reverse
    chronological.
 -  No private communities, no media uploads, no DMs.
 -  No Lemmy-specific extensions (`attributedTo`, `moderators`,
    `featured`, `postingRestrictedToMods`).  Lemmy can dereference the
    community actor and follow it, but it won't treat it as a full
    Lemmy community.

[Fedify]: https://fedify.dev/
[Next.js]: https://nextjs.org/
[tutorial]: https://fedify.dev/tutorial/threadiverse


Dependencies
------------

This project is written in TypeScript and runs on [Node.js].  You
need Node.js 22.0.0 or later.  Besides [Fedify] and [Next.js], the
runtime dependencies are:

 -  [Drizzle ORM] for database access.
 -  [*better-sqlite3*] for the SQLite driver.
 -  [*x-forwarded-fetch*] for honouring reverse-proxy headers.

See *package.json* for the full list.

[Node.js]: https://nodejs.org/
[Drizzle ORM]: https://orm.drizzle.team/
[*better-sqlite3*]: https://github.com/WiseLibs/better-sqlite3
[*x-forwarded-fetch*]: https://github.com/dahlia/x-forwarded-fetch


How to run
----------

Install dependencies:

~~~~ sh
npm install
~~~~

Create the SQLite database:

~~~~ sh
npm run db:push
~~~~

Start the Next.js development server:

~~~~ sh
npm run dev
~~~~

Visit <http://localhost:3000/> in your browser.

To federate with the rest of the fediverse, expose the server to the
public internet.  The quickest way is a tunnel:

~~~~ sh
npx @fedify/cli tunnel 3000
~~~~

See the [tunneling-services section of Fedify's manual][tunnels] for
alternatives.

[tunnels]: https://fedify.dev/manual/test#exposing-a-local-server-to-the-public


License
-------

This program is licensed under the [MIT License].  See the *LICENSE*
file for details.

[MIT License]: https://minhee.mit-license.org/2026/
