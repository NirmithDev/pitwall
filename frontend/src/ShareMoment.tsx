import { useState } from "react";
import Dialog from "./Dialog";
export default function ShareMoment({
  link,
  onClose,
}: {
  link: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <Dialog title="Share replay moment" onClose={onClose}>
      <p>
        Open this link to return to the same race, time, drivers, speed and
        position source. Playback starts paused.
      </p>
      <label className="lab-field">
        Replay link
        <input
          aria-label="Replay link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      <div className="lab-actions">
        <button
          className="save-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setMessage("Link copied.");
            } catch {
              setMessage(
                "Copy is unavailable here. Select the link above and copy it manually.",
              );
            }
          }}
        >
          Copy replay link
        </button>
        <a href={link} target="_blank" rel="noreferrer">
          Open link ↗
        </a>
      </div>
      <p role="status">{message}</p>
      <p className="lab-note">
        The link uses this server's address. A localhost link works only on your
        computer; a public deployment is needed for friends to open it. Recorded
        positions depend on the destination server's cache.
      </p>
    </Dialog>
  );
}
