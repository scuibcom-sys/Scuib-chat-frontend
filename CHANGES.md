# What I changed

Frontend only. Four things were on the list: files/images not sending, images
not showing up after "sending", onboarding not saving, and the chat looking too
playful. Notes below on what each one actually was and what I did about it.

I ran a full production build after the changes (`npm run build`) and it
compiles clean — type check passes, all 23 pages build. So nothing here should
blow up your hosting. (The only thing that tripped in my sandbox was the Google
Fonts download being blocked on my end; that's a network thing on my machine,
not the code, and your host fetches fonts fine.)

## Confirming a deploy went through

I added a little signature so you don't have to guess whether your push is live.
After you deploy, open the site, open the browser console, and you'll see a blue
"Scuib Chat msg-refresh-2026.06.02" badge printed once on load, with the list of
what's in the build. You can also type `window.__SCUIB_BUILD__` in the console
to read it back.

When you cut your next deploy, bump `BUILD_TAG` in `utils/buildSignature.ts` and
you'll get a fresh tag to look for. Files: `utils/buildSignature.ts` and
`components/BuildSignature.tsx` (mounted once in `app/layout.tsx`).

## 1. Can't send images / videos / files

The attach button was literally commented out in the composers
(`{/* File upload button is temporarily disabled ... */}`). The whole upload
path behind it was fine and still wired up — there was just no button on screen
to start it, so nothing could ever get picked.

I turned the button back on in the group composers. The full chain it kicks off
(picker -> Cloudinary signed upload -> send message) was already there and
untouched.

One I left off on purpose: the attach button in the direct-message composer.
The upload handler currently bails on anything that isn't a group chat
("File uploads are currently available in group chats only."), so switching it
on for DMs would just throw. That one needs the handler (and the backend side
for DM attachments) before it's worth enabling — flagged at the bottom.

## 2. Images "send" but nothing shows

This was the rendering. Every message view did
`message.attachments.map(a => a.name)` and dropped each name into a little
uppercase pill. The actual `url` and `mimeType` were never used, so even a
perfectly good image upload only ever showed up as a filename — which feels like
it vanished.

Swapped all three of those spots for one `MessageAttachments` component:

- images show inline, tap to open full size
- video shows a normal player
- anything else is a small file card that opens the file
- still-uploading items show a spinner instead of looking blank

I also gave the composer an instant local preview (`URL.createObjectURL`) so a
picked image shows right away while the real upload runs in the background. The
upload itself still uses the actual file, so this is preview-only — the real
server URL takes over once the message comes back.

If images still don't stick after this, it's worth a look on the backend side:
`collectCloudinaryUploadParams` in `utils/scuibApi.ts` dumps *every* field from
the signature response into the upload form, and Cloudinary will reject the
upload (401 invalid signature) if any of those weren't part of what it signed.
Watch the upload POST in the network tab to confirm.

## 3. Onboarding not saving

In `NewUserOnboardingFlow`, when the profile save came back `404`, the catch
block treated it as a win — marked onboarding complete and pushed you to the
dashboard. So a save that never landed looked successful. Classic silent fail.

I dropped that. A failed save now shows a real message and keeps you on the step
to retry, instead of pretending it worked.

Side note: `updateProfile` fires the same data in ~8 different body shapes across
PATCH/POST/PUT. That's usually a sign nobody pinned down the actual field names.
Once you know the real contract it can be one clean request — easier to read and
you'll get real validation errors back.

## 4. Chat looked too playful

Rebuilt the conversation look to read more like a normal messenger.

- All the colors now come from `--chat-*` variables in `app/globals.css`, so the
  same markup does light and dark. Dark mode turns on with `data-theme="dark"`
  on a parent, and it also follows the OS setting on its own.
- Bubbles: blue for you, neutral surface for everyone else, smaller corners, a
  small tail, light borders/shadows so they sit on the background properly.
- Read receipts next to the time — a clock while sending, a check once sent. The
  double-check "read" state is already built in; just feed it real seen-data
  when the backend has it.
- Timestamps and avatars kept, just cleaned up.
- The "Today" divider and the message-highlight color use the same variables.

Everything for this lives in `components/dashboard/DashboardWorkspace.tsx`:
`MessageBubble`, `MessageReceiptIndicator` (new), `ChatThreadMessage`,
`TodayDivider`, `MessageText`, and `MessageAttachments` (new).

## Running it

    npm install
    npm run build      # or: npx tsc --noEmit
    npm run dev

Quick things to eyeball once it's up:

1. Group chat -> the + button is back -> pick an image -> it previews, sends, and
   shows up as an actual image.
2. Send a PDF -> shows a file card that opens it.
3. Your own messages show sending -> sent next to the time.
4. Add `data-theme="dark"` somewhere up the tree (or flip your OS to dark) -> the
   thread goes dark.
5. If a profile save fails, you stay put with an error instead of landing on the
   dashboard.

## Still open (didn't touch)

- DM attachments: teach `handleUploadFilesSelected` (and the backend) about
  direct messages, then re-enable that composer's attach button.
- Real read receipts: pass `"read"` into `ChatThreadMessage` once you can tell
  the message was actually seen (`markConversationSeen` / `lastSeenLabel` are
  already there to build on).
- Tidy up `updateProfile` once the backend field names are settled.
- A proper app-wide dark mode toggle — the chat's ready for it, the rest of the
  app isn't yet.
