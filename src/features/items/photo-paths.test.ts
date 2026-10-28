import { describe, expect, it } from "vitest";
import { PHOTO_PATH_PATTERN, photoUrl, thumbPathFor } from "./photo-paths";

const path = "items/0b8e7a52-63c4-4c7e-9a8f-0a1b2c3d4e5f.jpg";

describe("photo paths", () => {
  it("derives the thumbnail and URLs", () => {
    expect(thumbPathFor(path)).toBe("items/0b8e7a52-63c4-4c7e-9a8f-0a1b2c3d4e5f.thumb.jpg");
    expect(photoUrl(path, "thumb")).toBe(
      "/photos/items/0b8e7a52-63c4-4c7e-9a8f-0a1b2c3d4e5f.thumb.jpg",
    );
    expect(photoUrl(path, "full")).toBe(`/photos/${path}`);
  });

  it("only accepts our own photo paths", () => {
    expect(PHOTO_PATH_PATTERN.test(path)).toBe(true);
    expect(PHOTO_PATH_PATTERN.test(thumbPathFor(path))).toBe(true);
    expect(PHOTO_PATH_PATTERN.test("items/../secrets.jpg")).toBe(false);
    expect(PHOTO_PATH_PATTERN.test("other/0b8e7a52-63c4-4c7e-9a8f-0a1b2c3d4e5f.jpg")).toBe(false);
  });
});
