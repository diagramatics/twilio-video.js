'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var FakeMediaStreamTrack = require('../../lib/fakemediastream').FakeMediaStreamTrack;
var inherits = require('util').inherits;
var LocalParticipant = require('../../../lib/localparticipant');
var sinon = require('sinon');
var log = require('../../lib/fakelog');

const LocalAudioTrack = sinon.spy(function(mediaStreamTrack) {
  EventEmitter.call(this);
  if (mediaStreamTrack) {
    this.id = mediaStreamTrack.id;
    this.kind = mediaStreamTrack.kind;
  }
  this.stop = sinon.spy();
});
inherits(LocalAudioTrack, EventEmitter);

const LocalVideoTrack = sinon.spy(function(mediaStreamTrack) {
  EventEmitter.call(this);
  if (mediaStreamTrack) {
    this.id = mediaStreamTrack.id;
    this.kind = mediaStreamTrack.kind;
  }
  this.stop = sinon.spy();
});
inherits(LocalVideoTrack, EventEmitter);

describe('LocalParticipant', () => {
  describe('constructor', () => {
    context('when a room is joined', () => {
      it('should have the updated "identity" and "sid"', () => {
        // In makeTest(), test.signaling.sid and test.signaling.identity are
        // set to null, to mimic the ParticipantSignaling constructor
        var test = makeTest({ state: 'connecting' });
        // Spoofing a room joining event by populating the
        // "identity" and "sid" members of the signaling instance
        test.signaling.identity = 'newIdentity';
        test.signaling.sid = 'newSid';
        // Now, localParticipant should have the updated "identity" and "sid"
        assert.equal(test.signaling.sid, test.participant.sid);
        assert.equal(test.signaling.identity, test.participant.identity);
      });
    });
  });

  [
    'addTrack',
    'removeTrack'
  ].forEach(method => {
    describe(`#${method}`, () => {
      var test;

      beforeEach(() => {
        test = makeTest();
        test.participant[`_${method}`] = sinon.spy(() => ({ foo: 'bar', stop: sinon.spy() }));
      });

      context('when called with an invalid argument', () => {
        it('should throw', () => {
          assert.throws(() => test.participant[method]('invalid track argument'));
        });

        it(`should not call ._${method}`, () => {
          try {
            test.participant[method]('invalid track argument');
          } catch (e) {
            assert(!test.participant[`_${method}`].calledOnce);
          }
        });
      });

      context('when called with a LocalTrack', () => {
        it('should not throw', () => {
          assert.doesNotThrow(() => test.participant[method](new test.LocalAudioTrack()));
          assert.doesNotThrow(() => test.participant[method](new test.LocalVideoTrack()));
        });

        it(`should call ._${method} with the given LocalTrack and return its return value`, () => {
          var localAudioTrack = new test.LocalAudioTrack();
          var ret = test.participant[method](localAudioTrack);
          delete(ret.stop);
          assert(test.participant[`_${method}`].calledWith(localAudioTrack));
          assert.deepEqual(ret, { foo: 'bar' });

          var localVideoTrack = new test.LocalVideoTrack();
          ret = test.participant[method](localVideoTrack);
          delete(ret.stop);
          assert(test.participant[`_${method}`].calledWith(localVideoTrack));
          assert.deepEqual(ret, { foo: 'bar' });
        });
      });

      context('when called with a MediaStreamTrack', () => {
        it('should not throw', () => {
          assert.doesNotThrow(() => test.participant[method](new FakeMediaStreamTrack('audio')));
          assert.doesNotThrow(() => test.participant[method](new FakeMediaStreamTrack('video')));
        });

        it(`should call ._${method} with the corresponding LocalTrack and return its return value`, () => {
          var localAudioTrack = new FakeMediaStreamTrack('audio');
          var ret = test.participant[method](localAudioTrack);
          var _methodArg = test.participant[`_${method}`].args[0][0];

          delete(ret.stop);
          assert(test.LocalAudioTrack.calledWith(localAudioTrack));
          assert(_methodArg instanceof test.LocalAudioTrack);
          assert.deepEqual(ret, { foo: 'bar' });

          var localVideoTrack = new FakeMediaStreamTrack('video');
          ret = test.participant[method](localVideoTrack);
          _methodArg = test.participant[`_${method}`].args[1][0];

          delete(ret.stop);
          assert(test.LocalVideoTrack.calledWith(localVideoTrack));
          assert(_methodArg instanceof test.LocalVideoTrack);
          assert.deepEqual(ret, { foo: 'bar' });
        });
      });

      if (method === 'removeTrack') {
        [
          [ 'when called without the "stop" argument' ],
          [ 'when called with stop=true', true ],
          [ 'when called with stop=false', false ]
        ].forEach(([ scenario, stop ]) => {
          var shouldCallStop = typeof stop === 'undefined' || stop
            ? true : false;

          context(scenario, () => {
            it(`should ${shouldCallStop ? '' : 'not'} call .stop on the LocalTrack returned by ._${method}`, () => {
              [
                test.LocalAudioTrack,
                test.LocalVideoTrack,
                FakeMediaStreamTrack.bind(null, 'audio'),
                FakeMediaStreamTrack.bind(null, 'video')
              ].forEach(LocalTrack => {
                var localTrack = new LocalTrack();
                var ret = test.participant[method](localTrack, stop);
                assert(shouldCallStop ? ret.stop.calledOnce
                  : !ret.stop.calledOnce);
              });
            });
          });
        });
      }
    });
  });

  [
    'addTracks',
    'removeTracks'
  ].forEach(method => {
    describe(`#${method}`, () => {
      var test;
      var trackMethod = method.slice(0, -1);

      beforeEach(() => {
        test = makeTest();
        test.participant[trackMethod] = sinon.spy(track => {
          return track.kind === 'audio' ? null : { foo: 'bar', stop: sinon.spy() };
        });
      });

      context('when called with an invalid argument', () => {
        it('should throw', () => {
          assert.throws(() => test.participant[method]('invalid tracks argument'));
        });
      });

      context('when called with an array of', () => {
        [
          [
            'LocalTracks',
            LocalAudioTrack.bind(null, new FakeMediaStreamTrack('audio')),
            LocalVideoTrack.bind(null, new FakeMediaStreamTrack('video'))
          ],
          [
            'MediaStreamTracks',
            FakeMediaStreamTrack.bind(null, 'audio'),
            FakeMediaStreamTrack.bind(null, 'video')
          ]
        ].forEach(([ arrayItemType, LocalAudioTrack, LocalVideoTrack ]) => {
          context(arrayItemType, () => {
            it('should not throw', () => {
              assert.doesNotThrow(() => test.participant[method]([
                new LocalAudioTrack(),
                new LocalVideoTrack()
              ]));
            });

            it(`should call .${trackMethod} for each LocalTrack`, () => {
              var localAudioTrack = new LocalAudioTrack();
              var localVideoTrack = new LocalVideoTrack();

              test.participant[method]([ localAudioTrack, localVideoTrack ]);
              sinon.assert.callCount(test.participant[trackMethod], 2);
              sinon.assert.calledWith(test.participant[trackMethod], localAudioTrack);
              sinon.assert.calledWith(test.participant[trackMethod], localVideoTrack);
            });

            it(`should return an array of the non-null return values of all the calls to .${trackMethod}`, () => {
              var localAudioTrack = new LocalAudioTrack();
              var localVideoTrack = new LocalVideoTrack();
              var ret = test.participant[method]([ localAudioTrack, localVideoTrack ]);

              assert(Array.isArray(ret));
              assert.equal(ret.length, 1);
              delete(ret[0].stop);
              assert.deepEqual(ret[0], { foo: 'bar' });
            });
          });
        });
      });
    });
  });

  describe('LocalTrack events', () => {
    context('"trackAdded" event', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('calls .addTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connecting' });
          var track = { _signaling: {} };
          test.participant.emit('trackAdded', track);
          assert.equal(track._signaling, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .addTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          var track = { _signaling: {} };
          test.participant.emit('trackAdded', track);
          assert.equal(track._signaling, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .addTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'disconnected' });
          var track = { _signaling: {} };
          test.participant.emit('trackAdded', track);
          assert(!test.signaling.addTrack.calledOnce);
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        it('does not call .addTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          test.signaling.emit('stateChanged', 'disconnected');
          var track = { _signaling: {} };
          test.participant.emit('trackAdded', track);
          assert(!test.signaling.addTrack.calledOnce);
        });
      });
    });

    context('"trackRemoved" event', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('calls .removeTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connecting' });
          var track = { _signaling: {} };
          test.participant.emit('trackRemoved', track);
          assert.equal(track._signaling, test.signaling.removeTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .removeTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          var track = { _signaling: {} };
          test.participant.emit('trackRemoved', track);
          assert.equal(track._signaling, test.signaling.removeTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .removeTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'disconnected' });
          var track = { _signaling: {} };
          test.participant.emit('trackRemoved', track);
          assert(!test.signaling.removeTrack.calledOnce);
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        it('does not call .removeTrack with the LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var test = makeTest({ state: 'connected' });
          test.signaling.emit('stateChanged', 'disconnected');
          var track = { _signaling: {} };
          test.participant.emit('trackRemoved', track);
          assert(!test.signaling.removeTrack.calledOnce);
        });
      });
    });

    context('"trackStopped" event', () => {
      context('when the LocalParticipant .state begins in "connecting"', () => {
        context('and a LocalTrack emits "stopped"', () => {
          it('emits "trackStopped"', () => {
            var track = new EventEmitter();
            var trackStopped;
            var test = makeTest({ tracks: [ track ] });
            test.participant.once('trackStopped', track => trackStopped = track);
            track.emit('stopped', track);
            assert.equal(track, trackStopped);
          });
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        context('and a LocalTrack emits "stopped"', () => {
          it('does not emit "trackStopped"', () => {
            var track = new EventEmitter();
            var trackStopped;
            var test = makeTest({ tracks: [ track ] });
            test.signaling.emit('stateChanged', 'disconnected');
            test.participant.once('trackStopped', track => trackStopped = track);
            track.emit('stopped', track);
            assert(!trackStopped);
          });
        });
      });

      context('when the LocalParticipant .state begins in "disconnected"', () => {
        context('and a LocalTrack emits "stopped"', () => {
          it('does not emit "trackStopped"', () => {
            var track = new EventEmitter();
            var trackStopped;
            var test = makeTest({ tracks: [ track ], state: 'disconnected' });
            test.participant.once('trackStopped', track => trackStopped = track);
            track.emit('stopped', track);
            assert(!trackStopped);
          });
        });
      });
    });

    context('.tracks', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('calls .addTrack with each LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var track = new EventEmitter();
          track._signaling = {};
          var test = makeTest({
            state: 'connecting',
            tracks: [track]
          });
          assert.equal(track._signaling, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('calls .addTrack with each LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var track = new EventEmitter();
          track._signaling = {};
          var test = makeTest({
            state: 'connected',
            tracks: [track]
          });
          assert.equal(track._signaling, test.signaling.addTrack.args[0][0]);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not call .addTrack with each LocalTrack\'s TrackSignaling on the ParticipantSignaling', () =>{
          var track = new EventEmitter();
          track._signaling = {};
          var test = makeTest({
            state: 'disconnected',
            tracks: [track]
          });
          assert(!test.signaling.addTrack.calledOnce);
        });
      });
    });
  });

  describe('ParticipantSignaling', () => {
    context('"stateChanged" event', () => {
      context('when the LocalParticipant .state is "connecting"', () => {
        it('re-emits "stateChanged" event states', () => {
          var test = makeTest({ state: 'connecting' });
          var stateChanged;
          test.participant.once('foo', participant => stateChanged = participant);
          test.signaling.emit('stateChanged', 'foo');
          assert.equal(
            test.participant,
            stateChanged);
        });
      });

      context('when the LocalParticipant .state is "connected"', () => {
        it('re-emits "stateChanged" event states', () => {
          var test = makeTest({ state: 'connected' });
          var stateChanged;
          test.participant.once('foo', participant => stateChanged = participant);
          test.signaling.emit('stateChanged', 'foo');
          assert.equal(
            test.participant,
            stateChanged);
        });
      });

      context('when the LocalParticipant .state is "disconnected"', () => {
        it('does not re-emit "stateChanged" event states', () => {
          var test = makeTest({ state: 'disconnected' });
          var stateChanged = false;
          test.participant.once('foo', () => stateChanged = true);
          test.signaling.emit('stateChanged', 'foo');
          assert(!stateChanged);
        });
      });

      context('when the LocalParticipant .state transitions to "disconnected"', () => {
        let test;
        let tracks1;
        let tracks2;

        beforeEach(() => {
          tracks1 = [];
          tracks2 = [];
          [tracks1, tracks2].forEach(tracks => {
            const audioTrack = new LocalAudioTrack(new FakeMediaStreamTrack('audio'), { log });
            tracks.push(audioTrack);

            const videoTrack = new LocalVideoTrack(new FakeMediaStreamTrack('video'), { log });
            tracks.push(videoTrack);
          });
        });

        context('and shouldStopLocalTracks is true', () => {
          beforeEach(() => {
            test = makeTest({
              LocalAudioTrack,
              LocalVideoTrack,
              shouldStopLocalTracks: true,
              state: 'connected',
              tracks: tracks1
            });

            tracks2.forEach(track => test.participant.addTrack(track));

            test.signaling.emit('stateChanged', 'disconnected');
          });

          it('stops any LocalTracks passed at construction', () => {
            tracks1.forEach(track => sinon.assert.calledOnce(track.stop));
          });

          it('does not stop any LocalTracks added after construction', () => {
            tracks2.forEach(track => sinon.assert.notCalled(track.stop));
          });
        });

        context('and shouldStopLocalTracks is false', () => {
          beforeEach(() => {
            test = makeTest({
              LocalAudioTrack,
              LocalVideoTrack,
              shouldStopLocalTracks: true,
              state: 'connected',
              tracks: tracks1
            });

            tracks2.forEach(track => test.participant.addTrack(track));

            test.signaling.emit('stateChanged', 'disconnected');
          });

          it('does not stop any LocalTracks passed at construction', () => {
            tracks1.forEach(track => sinon.assert.calledOnce(track.stop));
          });

          it('does not stop any LocalTracks added after construction', () => {
            tracks2.forEach(track => sinon.assert.notCalled(track.stop));
          });
        });

        it('does not re-emit "stateChanged" event states', () => {
          var test = makeTest({ state: 'connected' });
          test.signaling.emit('stateChanged', 'disconnected');
          var stateChanged = false;
          test.participant.once('foo', () => stateChanged = true);
          test.signaling.emit('stateChanged', 'foo');
          assert(!stateChanged);
        });
      });
    });
  });
});

function makeLocalTrackConstructors(options) {
  options = options || {};
  options.LocalAudioTrack = options.LocalAudioTrack || LocalAudioTrack;
  options.LocalVideoTrack = options.LocalVideoTrack || LocalVideoTrack;
  return options;
}

function makeTest(options) {
  options = makeLocalTrackConstructors(options || {});
  options.MediaStreamTrack = options.MediaStreamTrack || FakeMediaStreamTrack;
  options.signaling = options.signaling || makeSignaling(options);
  options.tracks = options.tracks || [];
  options.log = log;
  options.participant = options.participant ||
    new LocalParticipant(options.signaling, options.tracks, options);
  return options;
}

function makeSignaling(options) {
  var signaling = new EventEmitter();
  options = options || {};
  options.state = options.state || 'connecting';
  signaling.identity = options.identity || null;
  signaling.sid = options.sid || null;
  signaling.state = options.state;
  signaling.addTrack = sinon.spy(() => {});
  signaling.removeTrack = sinon.spy(() => {});
  return signaling;
}
