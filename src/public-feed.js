/**
 * SRCP Public Feed System
 * 
 * Features:
 * - Public content posting (text, images, videos)
 * - Content discovery and browsing
 * - Peer-to-peer content distribution
 * - Content moderation via TruthRank
 */

export class PublicFeed {
  constructor(p2pInternet) {
    this.p2p = p2pInternet;
    this.posts = new Map();
    this.subscriptions = new Set();
    this.cache = new Map(); // For media caching
  }

  /**
   * Initialize public feed
   */
  async initialize() {
    console.log('[PublicFeed] Initializing...');
    
    // Load cached posts from localStorage
    this.loadCachedPosts();
    
    // Setup listeners for new posts
    this.setupListeners();
    
    console.log('[PublicFeed] Ready');
  }

  /**
   * Post text content to public feed
   */
  async postText(content, options = {}) {
    const post = {
      id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      type: 'text',
      content: content,
      author: {
        did: this.p2p.identity.did,
        username: this.p2p.identity.username
      },
      timestamp: Date.now(),
      tags: options.tags || [],
      category: options.category || 'general',
      likes: 0,
      comments: [],
      shares: 0
    };

    // Store locally
    this.posts.set(post.id, post);
    this.saveToCach();
    
    // Broadcast to network
    await this.broadcastPost(post);
    
    console.log('[PublicFeed] Posted text:', post.id);
    return post;
  }

  /**
   * Post image to public feed
   */
  async postImage(imageFile, caption = '', options = {}) {
    // Convert image to base64
    const base64 = await this.fileToBase64(imageFile);
    
    const post = {
      id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      type: 'image',
      content: caption,
      media: {
        type: 'image',
        data: base64,
        filename: imageFile.name,
        size: imageFile.size,
        mimeType: imageFile.type
      },
      author: {
        did: this.p2p.identity.did,
        username: this.p2p.identity.username
      },
      timestamp: Date.now(),
      tags: options.tags || [],
      category: options.category || 'general',
      likes: 0,
      comments: [],
      shares: 0
    };

    // Store locally
    this.posts.set(post.id, post);
    this.cacheMedia(post.id, base64);
    
    // Broadcast to network
    await this.broadcastPost(post);
    
    console.log('[PublicFeed] Posted image:', post.id);
    return post;
  }

  /**
   * Post video to public feed
   */
  async postVideo(videoFile, caption = '', options = {}) {
    // For large files, we'll create a reference and stream on demand
    const post = {
      id: 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      type: 'video',
      content: caption,
      media: {
        type: 'video',
        filename: videoFile.name,
        size: videoFile.size,
        mimeType: videoFile.type,
        // For demo, we'll store small videos as base64
        // In production, this would use WebRTC data channels or WebTorrent
        data: videoFile.size < 10 * 1024 * 1024 ? await this.fileToBase64(videoFile) : null,
        streamAvailable: videoFile.size >= 10 * 1024 * 1024
      },
      author: {
        did: this.p2p.identity.did,
        username: this.p2p.identity.username
      },
      timestamp: Date.now(),
      tags: options.tags || [],
      category: options.category || 'general',
      likes: 0,
      comments: [],
      shares: 0
    };

    // Store locally
    this.posts.set(post.id, post);
    
    // Cache video if small enough
    if (post.media.data) {
      this.cacheMedia(post.id, post.media.data);
    }
    
    // Broadcast to network
    await this.broadcastPost(post);
    
    console.log('[PublicFeed] Posted video:', post.id);
    return post;
  }

  /**
   * Convert file to base64
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Broadcast post to connected peers
   */
  async broadcastPost(post) {
    const connectedPeers = this.p2p.getConnectedPeers();
    
    // Send to all connected peers
    for (const peer of connectedPeers) {
      try {
        await this.p2p.transport.send(peer.did, {
          type: 'public-feed:post',
          post: post
        });
      } catch (error) {
        console.warn('[PublicFeed] Failed to send to peer:', peer.did);
      }
    }

    // Also broadcast via registry if available
    if (this.p2p.registry) {
      this.p2p.registry.broadcast({
        type: 'public-feed:new-post',
        postId: post.id,
        author: post.author.did
      });
    }
  }

  /**
   * Get public feed (all posts)
   */
  getFeed(options = {}) {
    const {
      limit = 50,
      offset = 0,
      category = null,
      authorDID = null,
      sortBy = 'timestamp' // timestamp, likes, comments
    } = options;

    let posts = Array.from(this.posts.values());

    // Filter by category
    if (category) {
      posts = posts.filter(p => p.category === category);
    }

    // Filter by author
    if (authorDID) {
      posts = posts.filter(p => p.author.did === authorDID);
    }

    // Sort
    posts.sort((a, b) => {
      if (sortBy === 'likes') {
        return b.likes - a.likes;
      } else if (sortBy === 'comments') {
        return b.comments.length - a.comments.length;
      } else {
        return b.timestamp - a.timestamp;
      }
    });

    // Paginate
    return posts.slice(offset, offset + limit);
  }

  /**
   * Get single post
   */
  getPost(postId) {
    return this.posts.get(postId);
  }

  /**
   * Like a post
   */
  async likePost(postId) {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    post.likes++;
    
    // Broadcast like to network
    await this.broadcastAction({
      type: 'like',
      postId: postId,
      userDID: this.p2p.identity.did
    });

    return post;
  }

  /**
   * Comment on a post
   */
  async commentOnPost(postId, commentText) {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    const comment = {
      id: 'comment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      author: {
        did: this.p2p.identity.did,
        username: this.p2p.identity.username
      },
      text: commentText,
      timestamp: Date.now()
    };

    post.comments.push(comment);

    // Broadcast comment to network
    await this.broadcastAction({
      type: 'comment',
      postId: postId,
      comment: comment
    });

    return comment;
  }

  /**
   * Share a post
   */
  async sharePost(postId) {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    post.shares++;

    // Broadcast share to network
    await this.broadcastAction({
      type: 'share',
      postId: postId,
      userDID: this.p2p.identity.did
    });

    return post;
  }

  /**
   * Broadcast action (like, comment, share)
   */
  async broadcastAction(action) {
    const connectedPeers = this.p2p.getConnectedPeers();
    
    for (const peer of connectedPeers) {
      try {
        await this.p2p.transport.send(peer.did, {
          type: 'public-feed:action',
          action: action
        });
      } catch (error) {
        console.warn('[PublicFeed] Failed to send action to peer:', peer.did);
      }
    }
  }

  /**
   * Setup event listeners
   */
  setupListeners() {
    // Listen for new posts from peers
    this.p2p.transport.on('message', (from, message) => {
      if (message.type === 'public-feed:post') {
        this.handleIncomingPost(message.post);
      } else if (message.type === 'public-feed:action') {
        this.handleIncomingAction(message.action);
      }
    });

    // Listen for feed requests
    this.p2p.transport.on('message', (from, message) => {
      if (message.type === 'public-feed:request') {
        this.handleFeedRequest(from, message);
      }
    });
  }

  /**
   * Handle incoming post from peer
   */
  handleIncomingPost(post) {
    // Validate post
    if (!post.id || !post.author || !post.type) {
      console.warn('[PublicFeed] Invalid post received');
      return;
    }

    // Don't add duplicates
    if (this.posts.has(post.id)) {
      return;
    }

    // Add to feed
    this.posts.set(post.id, post);
    this.saveToCache();

    // Notify UI
    window.dispatchEvent(new CustomEvent('srcp:new-post', {
      detail: post
    }));

    console.log('[PublicFeed] Received new post:', post.id);
  }

  /**
   * Handle incoming action from peer
   */
  handleIncomingAction(action) {
    const post = this.posts.get(action.postId);
    if (!post) {
      return;
    }

    if (action.type === 'like') {
      post.likes++;
    } else if (action.type === 'comment') {
      post.comments.push(action.comment);
    } else if (action.type === 'share') {
      post.shares++;
    }

    this.saveToCache();

    // Notify UI
    window.dispatchEvent(new CustomEvent('srcp:post-updated', {
      detail: { postId: post.id, action: action.type }
    }));
  }

  /**
   * Handle feed request from peer
   */
  async handleFeedRequest(from, message) {
    const feed = this.getFeed(message.options || {});
    
    try {
      await this.p2p.transport.send(from, {
        type: 'public-feed:response',
        requestId: message.requestId,
        posts: feed
      });
    } catch (error) {
      console.warn('[PublicFeed] Failed to send feed to:', from);
    }
  }

  /**
   * Request feed from peer
   */
  async requestFeed(peerDID, options = {}) {
    const requestId = 'req_' + Date.now();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Feed request timeout'));
      }, 10000);

      const handler = (from, message) => {
        if (message.type === 'public-feed:response' && message.requestId === requestId) {
          clearTimeout(timeout);
          this.p2p.transport.off('message', handler);
          
          // Add received posts to our feed
          for (const post of message.posts) {
            this.handleIncomingPost(post);
          }
          
          resolve(message.posts);
        }
      };

      this.p2p.transport.on('message', handler);

      this.p2p.transport.send(peerDID, {
        type: 'public-feed:request',
        requestId: requestId,
        options: options
      });
    });
  }

  /**
   * Cache media to IndexedDB
   */
  cacheMedia(postId, data) {
    this.cache.set(postId, data);
    // In production, use IndexedDB for persistent storage
  }

  /**
   * Get cached media
   */
  getCachedMedia(postId) {
    return this.cache.get(postId);
  }

  /**
   * Save posts to localStorage
   */
  saveToCache() {
    try {
      const postsArray = Array.from(this.posts.entries());
      // Only save metadata, not large media files
      const metadata = postsArray.map(([id, post]) => {
        const { media, ...postMeta } = post;
        return [id, {
          ...postMeta,
          hasMedia: !!media,
          mediaType: media?.type
        }];
      });
      
      localStorage.setItem('srcp_public_feed', JSON.stringify(metadata));
    } catch (error) {
      console.warn('[PublicFeed] Failed to save to cache:', error);
    }
  }

  /**
   * Load posts from localStorage
   */
  loadCachedPosts() {
    try {
      const cached = localStorage.getItem('srcp_public_feed');
      if (cached) {
        const postsArray = JSON.parse(cached);
        this.posts = new Map(postsArray);
        console.log('[PublicFeed] Loaded', this.posts.size, 'cached posts');
      }
    } catch (error) {
      console.warn('[PublicFeed] Failed to load cache:', error);
    }
  }

  /**
   * Clear all posts
   */
  clearFeed() {
    this.posts.clear();
    this.cache.clear();
    localStorage.removeItem('srcp_public_feed');
    console.log('[PublicFeed] Feed cleared');
  }

  /**
   * Get feed statistics
   */
  getStats() {
    return {
      totalPosts: this.posts.size,
      textPosts: Array.from(this.posts.values()).filter(p => p.type === 'text').length,
      imagePosts: Array.from(this.posts.values()).filter(p => p.type === 'image').length,
      videoPosts: Array.from(this.posts.values()).filter(p => p.type === 'video').length,
      totalLikes: Array.from(this.posts.values()).reduce((sum, p) => sum + p.likes, 0),
      totalComments: Array.from(this.posts.values()).reduce((sum, p) => sum + p.comments.length, 0),
      totalShares: Array.from(this.posts.values()).reduce((sum, p) => sum + p.shares, 0)
    };
  }
}

/**
 * Initialize Public Feed with P2P Internet
 */
export async function initializePublicFeed(p2pInternet) {
  const feed = new PublicFeed(p2pInternet);
  await feed.initialize();
  return feed;
}