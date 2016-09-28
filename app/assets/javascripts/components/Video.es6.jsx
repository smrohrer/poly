const RecordRTC = require('recordrtc');

Video = React.createClass( {
  getInitialState() {
    return {
      accessToken: '',
      // ==>> This is what the user will have to change in order
      // to upload his video to his own channel:
      // go to console.developer.google.com and create an OAuth
      // clientID
      clientId: '463787160210-89kiojjsupa9u2g2s946g7em5d8t6kdj.apps.googleusercontent.com',
      // <<==
      scopes: [
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/plus.login',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      titleVideo: 'user_id+access_token',
      descVideo: 'user_id+access_token',
      privacyVideo: 'public',
      recordRTC: '',
      recordedBlob: '',
      uploadVideo: '',
      youtubeVideoEmbed: '',
    };
  },
  componentDidMount() {
    // This is where the authentication process starts
    if (typeof gapi !== 'undefined') {
      this.authorizeApp();
      this.props.onRenderVideoInput();
      return;
    }
    this.props.onCloseVideoComponent();
    alert('Could not load Google API, please check your connection.');

    const video = document.getElementById('camera-stream');
    video.muted = true;
  },

  /*
    Recording of our video
  */

  // This method is called when the user clicks on the record
  // button: it gets the stream from 'localMediaStream' and
  // stores it in our App state with saveRecordRTC
  onRecordVideo() {
    // Updates the shape of our button
    this.props.onStartRecordingClick();

    const video = document.getElementById('camera-stream');
    const stream = this.props.stream;
    video.src = window.URL.createObjectURL(stream);

    const options = {
      mimeType: 'video/webm',
      bitsPerSecond: 1200000,
      bufferSize: 16384,
      sampleRate: 96000,
    };
    const recordRTC = new Promise((resolve) => {
      resolve(RecordRTC(stream, options));
    });
    recordRTC.then((response) => {
      this.saveRecordRTC(response);
    }).then(() => {
      this.state.recordRTC.startRecording();
    });
  },

  // This method stops our recording and update our blob with a
  // name and a date to convert it into a file that we can upload
  // on Youtube:
  onStopRecording() {
    this.props.onStopRecordingClick();

    const video = document.querySelector('#camera-stream');
    video.muted = false;

    const recordRTC = this.state.recordRTC;
    recordRTC.stopRecording((audioVideoWebURL) => {
      // Create an object URL for the video stream and use this
      // to set the video source.
      video.src = audioVideoWebURL;

      // the conversion is done here
      const recordedBlob = recordRTC.getBlob();
      recordedBlob.lastModifiedDate = new Date();
      recordedBlob.name = 'VideoTest.webm';

      // and then we push the newly created file back into
      // our App state
      this.updateRecordedBlob(recordedBlob);
    });

    this.props.onStopStream();

    this.handleUploadTimeout();
  },

  /*
    Modify state methods
  */

  saveStreamData(stream) {
    this.setState({ stream });
  },


  saveToken(accessToken) {
    this.setState({ accessToken });
  },
  saveUploadVideoSession(uploadVideo) {
    this.setState({ uploadVideo });
  },
  saveRecordRTC(recordRTC) {
    this.setState({ recordRTC });
  },
  updateRecordedBlob(updatedBlob) {
    this.setState({ recordedBlob: updatedBlob });
  },
  saveVideoId(videoId) {
    this.setState({ videoId });
  },
  saveYoutubeUrl(videoId) {
    this.setState({
      youtubeVideoEmbed: `http://www.youtube.com/embed/${videoId}?showinfo=0&rel=0&color=white&autohide=1&controls=0`,
    });
  },

  /*
    UploadVideo: Constructor method
  */

  UploadVideo(self) {
    const video = document.getElementById('camera-stream');

    this.tags = ['youtube-cors-upload'];
    this.categoryId = 22;
    this.videoId = '';
    this.uploadStartTime = 0;

    this.ready = function (accessToken) {
      this.accessToken = accessToken;
      this.gapi = gapi;
      this.authenticated = true;
      this.gapi.client.request({
        path: '/youtube/v3/channels',
        params: {
          part: 'snippet',
          mine: true,
        },
        callback: function (response) {
          if (response.error) {
            console.log(response.error.message);
          }
        }.bind(this),
      });
    };
    this.uploadFile = function (file) {
      const metadata = {
        snippet: {
          title: self.state.titleVideo,
          description: self.state.descVideo,
          tags: this.tags,
          categoryId: this.categoryId,
        },
        status: {
          privacyStatus: self.state.privacyVideo,
        }
      };
      const uploader = new MediaUploader({
        baseUrl: 'https://www.googleapis.com/upload/youtube/v3/videos',
        file,
        token: self.state.accessToken,
        metadata,
        params: {
          part: Object.keys(metadata).join(','),
        },
        onError: function(data) {
          let message = data;
          try {
            const errorResponse = JSON.parse(data);
            message = errorResponse.error.message;
            console.log(message);
          } finally {
            alert(message);
          }
        }.bind(this),
        onComplete: function(data) {
          console.log('Upload complete');
          const uploadResponse = JSON.parse(data);
          this.videoId = uploadResponse.id;
          console.log(uploadResponse);

          // Takes care of calling our saveVideoId method
          // that allows us to stock our video ID in order
          // to display it afterwards
          const videoIdVar = this.videoId;
          self.handleVideoId(videoIdVar);

          // Hides upload video div and show our
          // fetched youtube video
        }.bind(this),
      });
      this.uploadStartTime = Date.now();
      uploader.upload();
    };

    this.handleUploadClick = function () {
      if(self.state.recordedBlob) {
        console.log('success');
        this.uploadFile(self.state.recordedBlob);
      } else {
        setTimeout(function() {
          self.handleUploadTimeout();
        }, 300);
      }
    };
  },
  // This checks whether the access token is fetched and stored
  // in our App state and calls the UploadVideo constructor
  // passing it our access token. This sets up our app to be
  // ready for uploading
  createUploadClass() {
    // This variable avoids having binding issue
    // regarding 'this' in UploadVideo()
    const self = this;

    if (this.state.accessToken !== '') {
      const UploadFunction = this.UploadVideo;
      const accessToken = this.state.accessToken;

      // This created a new session of our UploadVideo
      // and saves it to our App state
      const uploadVideo = new UploadFunction(self);
      self.saveUploadVideoSession(uploadVideo);

      self.state.uploadVideo.ready(accessToken);
    } else {
      setTimeout(this.createUploadClass, 100);
    }
  },

  /*
    Authentication with GoogleAPI
  */

  // This the first function called in our authentication process
  // it initiates the authentication
  authorizeApp() {
    const clientId = this.state.clientId;
    const scopes = this.state.scopes;
    const checkAuth = this.checkAuth;

    gapi.auth.init(() => {
      window.setTimeout(checkAuth(clientId, scopes), 1);
    });
  },

  // This checks with the API that our clientID and scopes are valid
  // ====>> this is where the youtube user account is defined
  // the clientID defines the account associated
  checkAuth(clientId, scopes) {
    gapi.auth.authorize({
      client_id: clientId,
      scope: scopes,
      immediate: true,
    },
    this.handleAuthResult);
  },

  // This checks whether there is any error with our cliendID and
  // scopes before pursuing
  handleAuthResult(authResult) {
    if (authResult && !authResult.error) {
      this.loadAPIClientInterfaces(authResult);
    } else {
      alert('Error while trying to authenticate.');
      this.props.onCloseVideoComponent();
    }
  },

  // This is the final step in our authentication:
  // an access token is fetched and stored in our App state
  // to be reused at the uploading stage
  loadAPIClientInterfaces(authResult) {
    // Stores our current token in state variable
    const accessToken = authResult.access_token;
    this.saveToken(accessToken);

    gapi.client.load('youtube', 'v3');
    console.log('gapi loaded');
    // After authentication is complete, we set up the future
    // upload
    this.createUploadClass();
  },

  /*
    Helper functions, for handling events
  */

  // This is called when the user clicks on the upload button
  // after having recorded a video
  handleUploadTimeout() {
    if (this.state.uploadVideo !== '') {
      this.state.uploadVideo.handleUploadClick();
    } else {
      setTimeout(this.handleUploadTimeout, 100);
    }
  },

  // Handles calling saveVideoId and
  // checks whether video is available from youtube servers

  handleVideoId(videoId) {
    this.saveYoutubeUrl(videoId);
      if (this.props.isTargetInputActive) {
        this.props.onTargetVideoSubmit(this.state.youtubeVideoEmbed);
        this.props.onToggleInputType();
      } else {
        this.props.onSourceVideoSubmit(this.state.youtubeVideoEmbed);
        this.props.onToggleInputType();
      }      
  },

  renderRecordButton() {
    if (this.props.isVideoRecording) {
      return (
        <button className="videoButtonContainer" onClick={this.onStopRecording}>
          <div className="videoButton"></div>
        </button>
      );
    }

    return (
      <button className="videoButtonContainer" onClick={this.onRecordVideo}>
        <div className="videoButton startRecording"></div>
      </button>
    );
  },

  render() {
    return (
      <div className="videoComponent">
        <video id="camera-stream" width="570" autoPlay />
        {this.renderRecordButton()}
        <button title="Cancel" onClick={this.props.onCancelEditPhrase} className="close icon">
          <img src={this.props.closeAlt} alt="close"/>
        </button>

        <button title="Text" onClick={this.props.onCloseVideoComponent} className="text icon">
          <img src={this.props.textAlt} alt="close"/>
        </button>

        <button hidden className="extra" ref= "button-download" id="button-download">
          Download
        </button>
        <button hidden className="extra" onClick={this.props.handleUploadClick} id="button-upload">
          Upload Video
        </button>
      </div>
    );
  },
});
