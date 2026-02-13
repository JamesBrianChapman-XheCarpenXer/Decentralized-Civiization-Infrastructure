/**
 * SRCP Voice/Video Call Protocol
 * WebRTC-based audio/video calls with DID addressing
 */

export class CallProtocol {
  constructor(identity, transport) {
    this.identity = identity;
    this.transport = transport;
    this.activeCalls = new Map();     // DID -> CallSession
    this.incomingCalls = new Map();   // DID -> CallOffer
  }

  /**
   * Initialize call protocol
   */
  async initialize() {
    // Setup call event handlers
    this.transport.on('call:incoming', ({ did, accept, reject }) => {
      this.handleIncomingCall(did, accept, reject);
    });

    this.transport.on('call:stream', ({ did, stream }) => {
      this.handleRemoteStream(did, stream);
    });

    this.transport.on('call:ended', ({ did }) => {
      this.handleCallEnded(did);
    });

    console.log('Call protocol initialized');
  }

  /**
   * Start voice call
   */
  async startVoiceCall(targetDID) {
    return this.startCall(targetDID, { audio: true, video: false });
  }

  /**
   * Start video call
   */
  async startVideoCall(targetDID) {
    return this.startCall(targetDID, { audio: true, video: true });
  }

  /**
   * Start call with media constraints
   */
  async startCall(targetDID, constraints) {
    try {
      // Get local media stream
      const localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create call session
      const session = {
        did: targetDID,
        type: constraints.video ? 'video' : 'voice',
        localStream,
        remoteStream: null,
        startTime: Date.now(),
        status: 'calling'
      };

      this.activeCalls.set(targetDID, session);

      // Initiate call via transport
      const { call, stream } = await this.transport.call(targetDID, localStream);
      
      session.remoteStream = stream;
      session.call = call;
      session.status = 'active';

      this.emit('call:started', { did: targetDID, session });

      return session;

    } catch (err) {
      console.error('Failed to start call:', err);
      this.emit('call:failed', { did: targetDID, error: err.message });
      throw err;
    }
  }

  /**
   * Handle incoming call
   */
  handleIncomingCall(did, accept, reject) {
    const callOffer = {
      from: did,
      timestamp: Date.now(),
      accept: async (constraints = { audio: true, video: false }) => {
        try {
          // Get local media stream
          const localStream = await navigator.mediaDevices.getUserMedia(constraints);
          
          // Accept call
          await accept(localStream);

          // Create call session
          const session = {
            did,
            type: constraints.video ? 'video' : 'voice',
            localStream,
            remoteStream: null,
            startTime: Date.now(),
            status: 'active'
          };

          this.activeCalls.set(did, session);
          this.incomingCalls.delete(did);

          this.emit('call:accepted', { did, session });

          return session;

        } catch (err) {
          console.error('Failed to accept call:', err);
          this.emit('call:failed', { did, error: err.message });
          throw err;
        }
      },
      reject: () => {
        reject();
        this.incomingCalls.delete(did);
        this.emit('call:rejected', { did });
      }
    };

    this.incomingCalls.set(did, callOffer);
    this.emit('call:incoming', { did, offer: callOffer });
  }

  /**
   * Handle remote stream received
   */
  handleRemoteStream(did, stream) {
    const session = this.activeCalls.get(did);
    if (session) {
      session.remoteStream = stream;
      this.emit('call:remote-stream', { did, stream });
    }
  }

  /**
   * Handle call ended
   */
  handleCallEnded(did) {
    const session = this.activeCalls.get(did);
    if (session) {
      // Stop all tracks
      if (session.localStream) {
        session.localStream.getTracks().forEach(track => track.stop());
      }
      if (session.remoteStream) {
        session.remoteStream.getTracks().forEach(track => track.stop());
      }

      const duration = Date.now() - session.startTime;
      
      this.activeCalls.delete(did);
      this.emit('call:ended', { did, duration });
    }
  }

  /**
   * End active call
   */
  endCall(targetDID) {
    const session = this.activeCalls.get(targetDID);
    if (!session) {
      console.warn('No active call with', targetDID);
      return;
    }

    // Close call
    if (session.call) {
      session.call.close();
    }

    // Stop local tracks
    if (session.localStream) {
      session.localStream.getTracks().forEach(track => track.stop());
    }

    this.handleCallEnded(targetDID);
  }

  /**
   * Mute/unmute audio
   */
  toggleAudio(targetDID) {
    const session = this.activeCalls.get(targetDID);
    if (!session || !session.localStream) return false;

    const audioTrack = session.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      session.audioMuted = !audioTrack.enabled;
      this.emit('call:audio-toggled', { 
        did: targetDID, 
        muted: session.audioMuted 
      });
      return session.audioMuted;
    }
    return false;
  }

  /**
   * Mute/unmute video
   */
  toggleVideo(targetDID) {
    const session = this.activeCalls.get(targetDID);
    if (!session || !session.localStream) return false;

    const videoTrack = session.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      session.videoMuted = !videoTrack.enabled;
      this.emit('call:video-toggled', { 
        did: targetDID, 
        muted: session.videoMuted 
      });
      return session.videoMuted;
    }
    return false;
  }

  /**
   * Switch camera (for mobile)
   */
  async switchCamera(targetDID) {
    const session = this.activeCalls.get(targetDID);
    if (!session || session.type !== 'video') return;

    try {
      const videoTrack = session.localStream.getVideoTracks()[0];
      const currentFacingMode = videoTrack.getSettings().facingMode;
      
      // Toggle between user and environment
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      
      // Get new stream
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: true
      });

      // Replace track
      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = session.call.peerConnection
        .getSenders()
        .find(s => s.track.kind === 'video');
      
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
        videoTrack.stop();
        
        this.emit('call:camera-switched', { did: targetDID });
      }

    } catch (err) {
      console.error('Failed to switch camera:', err);
    }
  }

  /**
   * Get active call with peer
   */
  getActiveCall(targetDID) {
    return this.activeCalls.get(targetDID);
  }

  /**
   * Get all active calls
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Check if in call with peer
   */
  isInCallWith(targetDID) {
    return this.activeCalls.has(targetDID);
  }

  /**
   * Get call stats
   */
  async getCallStats(targetDID) {
    const session = this.activeCalls.get(targetDID);
    if (!session || !session.call) return null;

    try {
      const stats = await session.call.peerConnection.getStats();
      const report = {};

      stats.forEach(stat => {
        if (stat.type === 'inbound-rtp') {
          report.bytesReceived = stat.bytesReceived;
          report.packetsReceived = stat.packetsReceived;
          report.packetsLost = stat.packetsLost;
        } else if (stat.type === 'outbound-rtp') {
          report.bytesSent = stat.bytesSent;
          report.packetsSent = stat.packetsSent;
        }
      });

      return report;

    } catch (err) {
      console.error('Failed to get call stats:', err);
      return null;
    }
  }

  /**
   * Event emitter
   */
  emit(eventType, data) {
    if (!this._eventHandlers) this._eventHandlers = new Map();
    const handlers = this._eventHandlers.get(eventType) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Register event handler
   */
  on(eventType, handler) {
    if (!this._eventHandlers) this._eventHandlers = new Map();
    if (!this._eventHandlers.has(eventType)) {
      this._eventHandlers.set(eventType, []);
    }
    this._eventHandlers.get(eventType).push(handler);
  }

  /**
   * End all active calls
   */
  endAllCalls() {
    const dids = Array.from(this.activeCalls.keys());
    dids.forEach(did => this.endCall(did));
  }
}
