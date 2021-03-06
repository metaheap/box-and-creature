(function() {
  var _isBrowser = typeof window !== 'undefined' && window.location;
  var _useInspector = _isBrowser && window.location.hash.indexOf('-inspect') !== -1;
  var _isMobile = _isBrowser && /(ipad|iphone|ipod|android)/gi.test(navigator.userAgent);
  var _isAutomatedTest = !_isBrowser || window._phantom;

  var Matter = _isBrowser ? window.Matter : require('matter-js');
  var World = Matter.World;
  var Body = Matter.Body;
  var Bodies = Matter.Bodies;
  var Composite = Matter.Composite;
  var Composites = Matter.Composites;
  var Constraint = Matter.Constraint;
  var Engine = Matter.Engine;
  var Common = Matter.Common;
  var Events = Matter.Events;
  var Render = Matter.Render;
  var Vector = Matter.Vector;
  var Bounds = Matter.Bounds;
  var Mouse = Matter.Mouse;
  var MouseConstraint = Matter.MouseConstraint;
  var Metaheap = {};
  var Game = {};
  var Creature = {};
  var Player = {};
  var Controls = {};
  var Puppet = {};
  var Arena = {};
  Matter.Game = Game;

  Game.create = function (id) {
    var defaults = {
      sceneEvents: []
    };

    // TODO: grab game from server based on id arguement
    var game = {
      session: {
        id: id || 1,
        type: 'ffa', // ffa, koth, ctf
        teamEnabled: true, // boolean
        sceneName: 'coliseum', // the map that everyone is playing on
        resources: [], // resources that players interact with
        participantId: 1,
        participants: [
          {
            id: 1,
            name: "hillary",
            teamId: 2,
            position: {x: 200, y: 100} // from the top left pixel of the viewport
          },
          {
            id: 2,
            name: "trump",
            teamId: 1,
            position: {x: 400, y: 400}
          },
          {
            id: 3,
            name: "sanders",
            teamId: 2,
            position: {x: 600, y: 600}
          }
        ]
      }
    };

    return Common.extend(defaults, game);
  };

  Game.init = function (id) {
    var game = Game.create(id);
    Matter.Game._game = game;

    // get container element for the canvas
    game.container = document.getElementById('canvas-container');

    /**
     * engine
     */
    // create an engine
    game.engine = Metaheap.engine(game);

    // run the engine
    game.runner = Engine.run(game.engine);

    /**
     * render
     */
    game.render = Render.create({
      element: game.container,
      engine: game.engine,
      options: {
        hasBounds: true, // A flag that specifies if render.bounds should be used when rendering.
        height: window.innerHeight,
        width: window.innerWidth
      }
    });

    // run the renderer
    Render.run(game.render);

    /**
     * setup
     */
    // set up a scene with bodies
    Game.reset(game);
    Game.setScene(game, game.session.sceneName);

    // set up game interface
    Game.initControls(game);

    // pass through runner as timing for debug rendering
    game.engine.metrics.timing = game.runner;

    return game;
  };

  // call init when the page has loaded fully
  if (!_isAutomatedTest) {
    if (window.addEventListener) {
      window.addEventListener('load', Game.init);
    } else if (window.attachEvent) {
      window.attachEvent('load', Game.init);
    }
  }

  // reinit when window resizes
  // window.addEventListener('resize', Game.init);

  Game.setScene = function (game, sceneName) {
    Metaheap[sceneName](game);
  };

  Game.reset = function (game) {
    var world = game.engine.world;
    var i;

    World.clear(world);
    Engine.clear(game.engine);

    // clear all scene events
    if (game.engine.events) {
      for (i = 0; i < game.sceneEvents.length; i++) {
        Events.off(game.engine, game.sceneEvents[i]);
      }
    }

    if (world.events) {
      for (i = 0; i < game.sceneEvents.length; i++) {
        Events.off(world, game.sceneEvents[i]);
      }
    }

    if (game.runner && game.runner.events) {
      for (i = 0; i < game.sceneEvents.length; i++) {
        Events.off(game.runner, game.sceneEvents[i]);
      }
    }

    if (game.render && game.render.events) {
      for (i = 0; i < game.sceneEvents.length; i++) {
        Events.off(game.render, game.sceneEvents[i]);
      }
    }

    game.sceneEvents = [];

    // reset id pool
    Body._nextCollidingGroupId = 1;
    Body._nextNonCollidingGroupId = -1;
    Body._nextCategory = 0x0001;
    Common._nextId = 0;

    // reset random seed
    Common._seed = 0;

    // reset engine properties
    game.engine.enableSleeping = false;
    game.engine.world.gravity.y = 0;
    game.engine.world.gravity.x = 0;
    game.engine.timing.timeScale = 1;

    // reset viewport center
    game.viewportCenter = {
      x: game.render.options.width * 0.5,
      y: game.render.options.height * 0.5
    };

    /**
     * resources
     */
    var offset = 500;
    World.add(world, [
      Bodies.rectangle(400, -offset, 800.5 + 2 * offset, 50.5, { isStatic: true }),
      Bodies.rectangle(400, 600 + offset, 800.5 + 2 * offset, 50.5, { isStatic: true }),
      Bodies.rectangle(800 + offset, 300, 50.5, 600.5 + 2 * offset, { isStatic: true }),
      Bodies.rectangle(-offset, 300, 50.5, 600.5 + 2 * offset, { isStatic: true })
    ]);

    // World.addComposite(
    //   world,
    //   Composites.softBody(
    //     500, 0, // x, y
    //     200, 2, // colms, rows
    //     5, 150, // columnGap, rowGap
    //     1, 25// crossBrace, particleRadius
    //   )
    // )

    /**
     * participants
     */
    // add the player to the world
    var player = game.session.participants.filter(function (participant) {
      return participant.id === game.session.participantId;
    })[0];

    game.player = player = Puppet.init(player);
    World.addComposite(world, player);

    console.log(player);

    // add the other participants to the world
    game.session.participants.forEach(function (participant) {
      // skip the player that we already just added
      if (participant.id !== player.metaheap.id) {
        // // set participents intentions relative to the player
        // if (game.session.teamEnabled === true) {
        //   if (game.player.teamId === participant.teamId) {
        //     participant.type = 'ally';
        //   } else {
        //     participant.type = 'enemy';
        //   }
        // } else {
        //   participant.type = 'enemy';
        // }

        var puppet = Puppet.init(participant);
        World.addComposite(world, puppet);
      }
    });


    if (game.player) {
      /**
       * mouse
       */
      game.mouseConstraint = MouseConstraint.create(game.engine, {
        element: game.render.canvas
      });

      World.add(world, game.mouseConstraint);

      // pass mouse to renderer to enable showMouseConstraint
      game.render.mouse = game.mouseConstraint.mouse;

      // constrain the center of the viewport to the player's body
      game.playerConstraint = Constraint.create({
        pointA: {
          x: game.render.options.width * 0.5,
          y: game.render.options.height * 0.5
        },
        pointB: game.player.bodies[0].position,
        render: {
          visible: false
        }
      });

      World.add(world, game.playerConstraint);

      // constrain mouse position to player body
      game.focusConstraint = Constraint.create({
        pointA: game.playerConstraint.pointB,
        pointB: game.mouseConstraint.mouse.position
      });

      World.add(world, game.focusConstraint);
    }

    /**
     * properties
     */
    if (game.render) {
      var renderOptions = game.render.options;
      renderOptions.wireframes = true;
      renderOptions.hasBounds = true; // required for views to work
      renderOptions.showDebug = false;
      renderOptions.showBroadphase = true;
      renderOptions.showBounds = false;
      renderOptions.showVelocity = false;
      renderOptions.showCollisions = false;
      renderOptions.showAxes = false;
      renderOptions.showPositions = false;
      renderOptions.showAngleIndicator = false;
      renderOptions.showIds = false;
      renderOptions.showShadows = false;
      renderOptions.showVertexNumbers = false;
      renderOptions.showConvexHulls = false;
      renderOptions.showInternalEdges = false;
      renderOptions.showSeparations = false;
      renderOptions.background = '#fff';

      if (_isMobile) {
        renderOptions.showDebug = true;
      }
    }
  };

  Game.initControls = function (game) {
    var mouseConstraint = game.mouseConstraint;
    var viewportCenter = game.viewportCenter;
    var player = game.player;
    player.rotation = 0; // number
    player.shooting = false; // boolean
    player.movement = {
      up: false,
      left: false,
      down: false,
      right: false
    };

    function crosshairMoved (event) {
      var delta = Vector.sub(game.playerConstraint.pointB, game.focusConstraint.pointB);
      player.rotation = Math.atan2(delta.y, delta.x);
    }

    function update (event, status) {
      switch (event.key) {
        case 'ArrowUp':
        case 'w':
          player.movement.up = status;
          break;

        case 'ArrowLeft':
        case 'a':
          player.movement.left = status;
          break;

        case 'ArrowDown':
        case 's':
          player.movement.down = status;
          break;

        case 'ArrowRight':
        case 'd':
          player.movement.right = status;
          break;

        default:
          // do nothing
          break;
      }
    }

    function startShooting (event) {
      player.shooting = true;
    }

    function stopShooting (event) {
      player.shooting = false;
    }

    function startMoving (event) {
      update(event, true);
    }

    function stopMoving (event) {
      update(event, false);
    }

    // keyboard controls player movement
    window.addEventListener('keydown', startMoving);
    window.addEventListener('keyup', stopMoving);

    // mouse controls player direction and weapons
    Events.on(mouseConstraint, 'mousemove', crosshairMoved);
    Events.on(mouseConstraint, 'mousedown', startShooting);
    Events.on(mouseConstraint, 'mouseup', stopShooting);
  };

  Puppet.init = function (options) {
    var puppet = Composites.car(
      options.position.x, // xx
      options.position.y, // yy
      100, // width
      50, // height
      50 // wheelsize
    );

    puppet.metaheap = options;

    return puppet;
  };

  Puppet.properties = function (options) {
    var defaults = {
      health: 10,
      maxHealth: 10,
      healthRegain: 1,
      bodyDamage: 1,
      bulletSpeed: 1,
      bulletPenetration: 1,
      bulletDamage: 1,
      reload: 1,
      movementSpeed: 1
    };

    return Common.extend(defaults, options);
  };

  Metaheap.engine = function (game) {
    var options = {
      positionIterations: 6,
      velocityIterations: 4,
      enableSleeping: false,
      metrics: {
        extended: true
      }
    };

    return Engine.create(options);
  };

  Metaheap.coliseum = function (game) {
    var engine = game.engine;
    var world = engine.world;
    var render = game.render;
    var player = game.player;
    var sceneEvents = game.sceneEvents;
    var viewportCenter = game.viewportCenter;
    var playerConstraint = game.playerConstraint;
    var focusConstraint = game.focusConstraint;
    var mouseConstraint = game.mouseConstraint;

    // beforeTick
    // tick
    // beforeUpdate
    // collisionStart
    // collisionActive
    // collisionEnd
    // afterUpdate
    // afterTick
    // beforeRender
    // afterRender
    sceneEvents.push(


      // fired at the start of a tick, before any updates to the engine or timing
      Events.on(engine, 'beforeTick', function (event) {
        /**
         * game controls and viewport
         */
        // console.log("beforeTick");

        // adjust viewport to the current player
        var deltaCenter = Vector.sub(playerConstraint.pointB, playerConstraint.pointA);
        Bounds.shift(render.bounds, deltaCenter);

        // update mouse
        Mouse.setOffset(mouseConstraint.mouse, render.bounds.min);
      }),
      Events.on(engine, "tick", function (event) {
        /**
         * accept player input
         */
        // console.log("tick");

        // player rotation
        Body.setAngle(player.bodies[0], player.rotation + (Math.PI/180) * 90);

        // player movement
        Body.applyForce(
          player.bodies[0],
          player.bodies[0].position,
          (function () {
            var move = player.movement;
            var x = 0;
            var y = 0;

            if (move.up) y += -0.005;
            if (move.left) x += -0.005;
            if (move.down) y += 0.005;
            if (move.right) x += 0.005;

            return Vector.create(x, y);
          })()
        );

        // player weapons
        if (player.shooting) {
          var bullet = Bodies.circle(
            playerConstraint.pointB.x,
            playerConstraint.pointB.y,
            10, // radius
            {
              frictionAir: 0,
              force: Vector.rotate(
                {
                  x: 0.0,
                  y: 0.02 // bullet speed
                },
                player.bodies[0].angle
              )
            }
          );
          World.addBody(world, bullet);
        }

      }),
      Events.on(engine, "beforeUpdate", function (event) {
        /**
         * server: correct positions
         */
        // console.log("beforeUpdate");

        // notify server of all bullet/player collisions
      }),
      Events.on(engine, "collisionStart", function (event) {
        /**
         * bullet collision
         */
        console.log("collisionStart");

        console.log(event.pairs[0]);
      }),
      Events.on(engine, "collisionActive", function (event) {
        /**
         * bullet collision
         */
        console.log("collisionActive");

        console.log(event.pairs[0]);
      }),
      Events.on(engine, "collisionEnd", function (event) {
        /**
         * bullet collision
         */
        console.log("collisionEnd");

        console.log(event.pairs[0]);
      }),
      Events.on(engine, "afterUpdate", function (event) {
        /**
         * server: report positions
         */
        // console.log("afterUpdate");
      }),
      Events.on(engine, "afterTick", function (event) {
        // console.log("afterTick");
      }),
      Events.on(render, "beforeRender", function (event) {
        // console.log("beforeRender");
      }),
      Events.on(render, "afterRender", function (event) {
        // console.log("afterRender");
      })
    );
  };
})();
