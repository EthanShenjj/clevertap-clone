"use client";
import { personalize } from "@/lib/domain";
import {
  EMPTY_CONTENT,
  type ChannelType,
  type MessageContent,
  type Person,
} from "@/lib/types";
import {
  ArrowDown,
  ArrowUp,
  BatteryFull,
  Bell,
  ImageIcon,
  Monitor,
  MousePointer2,
  Plus,
  Smartphone,
  Trash2,
  Type,
  Wifi,
} from "lucide-react";
import { useState } from "react";
import { Button, Field, IconButton } from "./ui";

export function MessageEditor({
  channel,
  content,
  onChange,
}: {
  channel: ChannelType;
  content: MessageContent;
  onChange: (content: MessageContent) => void;
}) {
  const update = (patch: Partial<MessageContent>) =>
    onChange({ ...content, ...patch });
  const addVariable = (field: "title" | "body" | "subject", variable: string) =>
    update({ [field]: content[field] + " {{" + variable + "}}" });
  return (
    <div className="message-form">
      {channel === "Email" ? (
        <>
          <Field label="Email subject">
            <input
              value={content.subject}
              onChange={(e) => update({ subject: e.target.value })}
              placeholder="A subject they'll want to open"
            />
          </Field>
          <Field label="Preview text">
            <input
              value={content.preheader}
              onChange={(e) => update({ preheader: e.target.value })}
              placeholder="A little more reason to open..."
            />
          </Field>
        </>
      ) : (
        <Field label={channel === "Push" ? "Notification title" : "Headline"}>
          <input
            value={content.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Make a good first impression"
          />
        </Field>
      )}
      <Field label="Message">
        <textarea
          value={content.body}
          onChange={(e) => update({ body: e.target.value })}
          rows={5}
          placeholder="What would you like to say?"
        />
      </Field>
      <div className="personalize-toolbar">
        <span>Make it personal</span>
        {["first_name", "city", "plan"].map((variable) => (
          <button key={variable} onClick={() => addVariable("body", variable)}>
            {"{{" + variable + "}}"}
          </button>
        ))}
      </div>
      <div className="form-grid">
        <Field label="Button text">
          <input
            value={content.cta}
            onChange={(e) => update({ cta: e.target.value })}
            placeholder="Explore more"
          />
        </Field>
        <Field label="Destination URL">
          <input
            type="url"
            value={content.url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://example.com"
          />
        </Field>
      </div>
      {channel !== "Email" ? (
        <Field label="Image URL (optional)">
          <input
            type="url"
            value={content.image}
            onChange={(e) => update({ image: e.target.value })}
            placeholder="https://..."
          />
        </Field>
      ) : null}
      {channel === "In-App" || channel === "Web Pop-up" ? (
        <div className="form-grid">
          <Field label="Background color">
            <div className="color-input">
              <input
                type="color"
                value={content.background}
                onChange={(e) => update({ background: e.target.value })}
              />
              <span>{content.background}</span>
            </div>
          </Field>
          <Field label="Position">
            <select
              value={content.position}
              onChange={(e) => update({ position: e.target.value })}
            >
              {["Center", "Top", "Bottom"].map((position) => (
                <option key={position}>{position}</option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}
      {channel === "Email" ? (
        <div className="block-editor">
          <div className="block-editor-heading">
            <strong>Content blocks</strong>
            <span>Build your message, one block at a time.</span>
          </div>
          {content.blocks.map((block, index) => (
            <div className="content-block" key={block.id}>
              <div className="content-block-heading">
                <span>
                  {block.type === "text" ? (
                    <Type size={14} />
                  ) : block.type === "image" ? (
                    <ImageIcon size={14} />
                  ) : (
                    <MousePointer2 size={14} />
                  )}
                  {block.type}
                </span>
                <div>
                  <IconButton
                    label={"Move block " + (index + 1) + " up"}
                    disabled={index === 0}
                    onClick={() => {
                      const blocks = [...content.blocks];
                      [blocks[index - 1], blocks[index]] = [
                        blocks[index],
                        blocks[index - 1],
                      ];
                      update({ blocks });
                    }}
                  >
                    <ArrowUp size={13} />
                  </IconButton>
                  <IconButton
                    label={"Move block " + (index + 1) + " down"}
                    disabled={index === content.blocks.length - 1}
                    onClick={() => {
                      const blocks = [...content.blocks];
                      [blocks[index + 1], blocks[index]] = [
                        blocks[index],
                        blocks[index + 1],
                      ];
                      update({ blocks });
                    }}
                  >
                    <ArrowDown size={13} />
                  </IconButton>
                  <IconButton
                    label={"Remove block " + (index + 1)}
                    onClick={() =>
                      update({
                        blocks: content.blocks.filter((b) => b.id !== block.id),
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </div>
              {block.type === "text" ? (
                <textarea
                  aria-label={"Text block " + (index + 1)}
                  rows={2}
                  value={block.value}
                  onChange={(e) =>
                    update({
                      blocks: content.blocks.map((b) =>
                        b.id === block.id ? { ...b, value: e.target.value } : b,
                      ),
                    })
                  }
                />
              ) : (
                <input
                  aria-label={block.type + " block " + (index + 1)}
                  value={block.value}
                  onChange={(e) =>
                    update({
                      blocks: content.blocks.map((b) =>
                        b.id === block.id ? { ...b, value: e.target.value } : b,
                      ),
                    })
                  }
                  placeholder={
                    block.type === "image"
                      ? "https://image-url..."
                      : "Button text"
                  }
                />
              )}
            </div>
          ))}
          <div className="block-add-buttons">
            {(["text", "image", "button"] as const).map((type) => (
              <Button
                key={type}
                variant="secondary"
                onClick={() =>
                  update({
                    blocks: [
                      ...content.blocks,
                      {
                        id: crypto.randomUUID(),
                        type,
                        value: type === "button" ? "Explore more" : "",
                      },
                    ],
                  })
                }
              >
                <Plus size={13} />
                {type}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
export function MessagePreview({
  channel,
  content: raw,
  person,
  small = false,
}: {
  channel: string;
  content: MessageContent;
  person?: Person;
  small?: boolean;
}) {
  const content = personalize({ ...EMPTY_CONTENT, ...raw }, person);
  const [device, setDevice] = useState("mobile");
  return (
    <div className={"message-preview " + (small ? "small-preview" : "")}>
      {!small ? (
        <div className="preview-toolbar">
          <span>LIVE PREVIEW</span>
          <div>
            <IconButton
              label="Mobile preview"
              className={device === "mobile" ? "selected" : ""}
              onClick={() => setDevice("mobile")}
            >
              <Smartphone size={16} />
            </IconButton>
            <IconButton
              label="Desktop preview"
              className={device === "desktop" ? "selected" : ""}
              onClick={() => setDevice("desktop")}
            >
              <Monitor size={16} />
            </IconButton>
          </div>
        </div>
      ) : null}
      <div
        className={
          "preview-stage preview-" +
          channel.toLowerCase().replaceAll(" ", "-") +
          " " +
          device
        }
      >
        {channel === "Email" ? (
          <div className="email-preview">
            <div className="email-browser">
              <i />
              <i />
              <i />
              <span>Message preview</span>
            </div>
            <div className="email-envelope">
              <strong>{content.subject || "Your email subject"}</strong>
              <span>Shopwise &lt;hello@shopwise.example.com&gt;</span>
              <small>{content.preheader}</small>
            </div>
            <div className="email-canvas">
              <span className="shopwise-wordmark">
                shopwise<span>®</span>
              </span>
              <div className="email-editorial">
                <span>GOOD THINGS, PICKED FOR YOU</span>
                <h2>{content.title || "Find your next favorite."}</h2>
              </div>
              <div className="email-message">
                {content.body || "Your message will appear here."}
              </div>
              {content.blocks.map((block) =>
                block.type === "image" ? (
                  block.value && /^https?:\/\//.test(block.value) ? (
                    <div
                      key={block.id}
                      className="email-image"
                      style={{
                        backgroundImage:
                          'url("' + block.value.replaceAll('"', "%22") + '")',
                      }}
                      role="img"
                      aria-label="Message image"
                    />
                  ) : null
                ) : block.type === "button" ? (
                  <span className="preview-cta" key={block.id}>
                    {block.value || content.cta}
                  </span>
                ) : (
                  <p className="email-block-text" key={block.id}>
                    {block.value}
                  </p>
                ),
              )}
              <div className="email-fine-print">
                A little inspiration from Shopwise.
                <br />
                You&apos;re receiving this because you&apos;re part of our
                community.
                <br />
                <u>Unsubscribe</u> · <u>Preferences</u>
              </div>
            </div>
          </div>
        ) : channel === "Push" ||
          channel === "Web Push" ||
          channel === "SMS" ||
          channel === "WhatsApp" ||
          channel === "RCS" ? (
          <div className="phone-preview">
            <div className="phone-status">
              <span>9:41</span>
              <span>
                <Wifi size={12} />
                <BatteryFull size={15} />
              </span>
            </div>
            <div className="phone-clock">
              <strong>9:41</strong>
              <span>Thursday, November 19</span>
            </div>
            <div className="push-notification">
              <div>
                <span className="notification-app">
                  <Bell size={12} />
                </span>
                <strong>SHOPWISE</strong>
                <span>now</span>
              </div>
              <h4>{content.title || "Your notification title"}</h4>
              <p>{content.body || "Your message will appear here."}</p>
              {content.image ? (
                <div
                  className="notification-image"
                  style={{
                    backgroundImage:
                      'url("' + content.image.replaceAll('"', "%22") + '")',
                  }}
                  role="img"
                  aria-label="Notification image"
                />
              ) : null}
              {content.cta ? (
                <span className="notification-link">{content.cta}</span>
              ) : null}
            </div>
            <div className="phone-home" />
          </div>
        ) : (
          <div
            className={
              channel === "Web Pop-up"
                ? "web-preview"
                : "phone-preview in-app-device"
            }
          >
            {channel === "Web Pop-up" ? (
              <div className="web-preview-bar">
                <i />
                <i />
                <i />
                <span>shopwise.example.com</span>
              </div>
            ) : (
              <div className="phone-status">
                <span>9:41</span>
                <span>
                  <Wifi size={12} />
                  <BatteryFull size={15} />
                </span>
              </div>
            )}
            <div className="mock-store">
              <span className="shopwise-wordmark">shopwise.</span>
              <span className="store-nav">
                Shop &nbsp; New arrivals &nbsp; Collections
              </span>
              <div className="store-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    <span />
                    <i />
                    <i />
                  </div>
                ))}
              </div>
            </div>
            <div
              className={
                "popup-overlay position-" + content.position.toLowerCase()
              }
            >
              <div
                className="popup-message"
                style={{ background: content.background }}
              >
                <span className="popup-close">×</span>
                <span className="popup-eyebrow">
                  A LITTLE SOMETHING FOR YOU
                </span>
                {content.image ? (
                  <div
                    className="popup-image"
                    style={{
                      backgroundImage:
                        'url("' + content.image.replaceAll('"', "%22") + '")',
                    }}
                  />
                ) : null}
                <h3>{content.title || "Your next favorite is waiting."}</h3>
                <p>{content.body || "Your message will appear here."}</p>
                <span className="preview-cta">
                  {content.cta || "Explore more"}
                </span>
                <small>Made for your everyday.</small>
              </div>
            </div>
          </div>
        )}
      </div>
      {!small ? (
        <p className="preview-caption">
          Personalization uses the selected sample profile.
        </p>
      ) : null}
    </div>
  );
}
