/**
 * Quadtree Spatial Partitioning
 * For optimizing collision detection in BioCrabs simulation
 */

// Boundaries for a node (rectangle in 2D space)
class Boundary {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  // Check if a point (with radius) intersects with this boundary
  contains(point) {
    return (
      point.x >= this.x - point.radius &&
      point.x <= this.x + this.width + point.radius &&
      point.y >= this.y - point.radius &&
      point.y <= this.y + this.height + point.radius
    );
  }

  // Check if this boundary intersects with another boundary
  intersects(range) {
    return !(
      range.x - range.width > this.x + this.width ||
      range.x + range.width < this.x - this.width ||
      range.y - range.height > this.y + this.height ||
      range.y + range.height < this.y - this.height
    );
  }
}

// Quadtree Node implementation
class QuadtreeNode {
  constructor(boundary, capacity, maxDepth = 8, depth = 0) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.objects = [];
    this.divided = false;
    this.children = [];
    this.depth = depth;
    this.maxDepth = maxDepth;
  }

  // Subdivide this node into four quadrants
  subdivide() {
    const x = this.boundary.x;
    const y = this.boundary.y;
    const w = this.boundary.width;
    const h = this.boundary.height;
    const halfW = w / 2;
    const halfH = h / 2;

    // Create boundaries for the four quadrants
    const neBoundary = new Boundary(x + halfW, y, halfW, halfH);
    const nwBoundary = new Boundary(x, y, halfW, halfH);
    const seBoundary = new Boundary(x + halfW, y + halfH, halfW, halfH);
    const swBoundary = new Boundary(x, y + halfH, halfW, halfH);

    // Create the four children nodes
    const nextDepth = this.depth + 1;
    this.children[0] = new QuadtreeNode(neBoundary, this.capacity, this.maxDepth, nextDepth);
    this.children[1] = new QuadtreeNode(nwBoundary, this.capacity, this.maxDepth, nextDepth);
    this.children[2] = new QuadtreeNode(seBoundary, this.capacity, this.maxDepth, nextDepth);
    this.children[3] = new QuadtreeNode(swBoundary, this.capacity, this.maxDepth, nextDepth);

    this.divided = true;

    // Redistribute objects from this node to its children
    for (let i = 0; i < this.objects.length; i++) {
      const success = this.insertToChildren(this.objects[i]);
      // If insertion failed (rare case due to numerical precision issues),
      // keep the object in this node
      if (!success) {
        console.warn("Object could not be inserted into children, keeping in parent node");
      }
    }
    
    // Clear the objects array of this node since they've been distributed
    this.objects = [];
  }

  // Helper method to insert object to children
  insertToChildren(object) {
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].insert(object)) {
        return true;
      }
    }
    return false;
  }

  // Insert an object into this quadtree node
  insert(object) {
    // If this object doesn't belong in this node, exit early
    if (!this.boundary.contains(object)) {
      return false;
    }

    // If there's still capacity and the node is not divided, add the object here
    if (this.objects.length < this.capacity && !this.divided) {
      this.objects.push(object);
      return true;
    }

    // If we reach maximum depth, don't subdivide further
    if (this.depth >= this.maxDepth) {
      this.objects.push(object);
      return true;
    }

    // If this node is not yet divided, subdivide it
    if (!this.divided) {
      this.subdivide();
    }

    // Try to insert the object into one of this node's children
    return this.insertToChildren(object);
  }

  // Query objects that are in a given range
  queryRange(range, found = []) {
    // If this boundary doesn't intersect with the query range, exit early
    if (!this.boundary.intersects(range)) {
      return found;
    }

    // Add objects from this node that are within the range
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      // Check if the object is within the query range
      // For simplicity, we consider a point with a radius to be within the range
      // if its center is within the extended range
      const objX = obj.x;
      const objY = obj.y;
      if (
        objX >= range.x - obj.radius &&
        objX <= range.x + range.width + obj.radius &&
        objY >= range.y - obj.radius &&
        objY <= range.y + range.height + obj.radius
      ) {
        found.push(obj);
      }
    }

    // If this node is divided, query all children
    if (this.divided) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].queryRange(range, found);
      }
    }

    return found;
  }

  // Clear the quadtree node for reuse
  clear() {
    this.objects = [];
    if (this.divided) {
      for (let i = 0; i < this.children.length; i++) {
        this.children[i].clear();
      }
      this.divided = false;
      this.children = [];
    }
  }
}

// Main Quadtree class
export class Quadtree {
  constructor(x, y, width, height, capacity = 8, maxDepth = 8) {
    this.boundary = new Boundary(x, y, width, height);
    this.root = new QuadtreeNode(this.boundary, capacity, maxDepth);
    this._objectIdCounter = 0;
  }

  // Insert an object with a unique ID to prevent duplicate collision checks
  insert(object) {
    // Ensure object has a unique ID for collision prevention
    if (object._quadId === undefined) {
      object._quadId = this._objectIdCounter++;
    }
    return this.root.insert(object);
  }

  // Query objects in a range
  queryRange(range) {
    return this.root.queryRange(range);
  }

  // Clear the quadtree for reuse
  clear() {
    this.root.clear();
    this._objectIdCounter = 0;
  }
} 