export class AABB {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public width: number = 0,
    public height: number = 0
  ) {}

  get left(): number {
    return this.x;
  }
  set left(val: number) {
    this.x = val;
  }

  get right(): number {
    return this.x + this.width;
  }
  set right(val: number) {
    this.x = val - this.width;
  }

  get top(): number {
    return this.y;
  }
  set top(val: number) {
    this.y = val;
  }

  get bottom(): number {
    return this.y + this.height;
  }
  set bottom(val: number) {
    this.y = val - this.height;
  }

  get centerX(): number {
    return this.x + this.width / 2;
  }

  get centerY(): number {
    return this.y + this.height / 2;
  }

  intersects(other: AABB): boolean {
    return (
      this.x < other.x + other.width &&
      this.x + this.width > other.x &&
      this.y < other.y + other.height &&
      this.y + this.height > other.y
    );
  }

  contains(other: AABB): boolean {
    return (
      other.x >= this.x &&
      other.x + other.width <= this.x + this.width &&
      other.y >= this.y &&
      other.y + other.height <= this.y + this.height
    );
  }

  containsPoint(px: number, py: number): boolean {
    return (
      px >= this.x &&
      px <= this.x + this.width &&
      py >= this.y &&
      py <= this.y + this.height
    );
  }

  clone(): AABB {
    return new AABB(this.x, this.y, this.width, this.height);
  }

  copyFrom(other: AABB): void {
    this.x = other.x;
    this.y = other.y;
    this.width = other.width;
    this.height = other.height;
  }

  set(x: number, y: number, width: number, height: number): void {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}
