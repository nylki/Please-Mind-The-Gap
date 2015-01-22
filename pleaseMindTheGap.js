Physijs.scripts.worker = 'lib/Physijs/physijs_worker.js';
Physijs.scripts.ammo = 'examples/js/ammo.js';


var verticalMovement, horizontalMovement;
var scene;

var camera, player, activeObject, activeObjectPicker;
var renderer;
var moveForward, moveBackward, moveLeft, moveRight;
var perlin;
var clock;

var boxgeom, boxmesh, material_standard, groundGeometry, ground, groundMaterial;
var directionalLight1, directionalLight2;
var activeMaterial, preActiveMaterial;
var artefacts = [];

var chanceGravity = 0.5;
var chanceCreator = chanceCreator + 0.1;
var chanceStandard = 1.0 - chanceCreator;

//-------------------------------------------------
var normalCameraHeight = 2;
var normalPlayerPosition = normalCameraHeight/2;
//-------------------------------------------------

/*
TODO: Draw orientation bubble in the middle

*/

document.addEventListener( 'mousemove', onDocumentMouseMove, false );
document.addEventListener( 'mousedown', onDocumentMouseDown, false );

document.addEventListener( 'keydown', onKeyDown, false );
document.addEventListener( 'keyup', onKeyUp, false );

function init(){
  console.log("init...");
  perlin = new ImprovedNoise();

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.shadowMapEnabled = false;
  renderer.shadowMapSoft = false;

  renderer.shadowCameraNear = 3;
  renderer.shadowCameraFar = 200;
  renderer.shadowCameraFov = 50;

  renderer.shadowMapBias = 0.0039;
  renderer.shadowMapDarkness = 0.5;
  renderer.shadowMapWidth = 1024;
  renderer.shadowMapHeight = 1024;
  document.body.appendChild(renderer.domElement);

  scene = new Physijs.Scene;
  scene.setGravity(new THREE.Vector3( 0, -5, 0 ));

  directionalLight1 = new THREE.DirectionalLight( 0xdefdff, 0.8 );
  directionalLight1.position.set( 0, 1, 0 );
  directionalLight1.rotation.set(0.5, 0.9, 0.2);
  scene.add( directionalLight1 );

  directionalLight2 = new THREE.DirectionalLight( 0xdefdff, 0.3 );
  directionalLight2.position.set( 0, -1, 0 );
  directionalLight2.rotation.set(-0.1, 0.4, 0.7);
  scene.add( directionalLight2 );


// TODO create non slippery material for player
  player = new Physijs.CapsuleMesh(
    new THREE.CylinderGeometry(1, 1, normalCameraHeight, 16 ),
    new THREE.MeshBasicMaterial({ color: 0x888888 })
  );
  player.visible = false;
  player.userData.category = "player";
  player.position.y = normalPlayerPosition;


  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.2, 200);
  camera.rotation.order = "YXZ"; // necessary to get prope camera rotation
  camera.position.set(0, normalCameraHeight, 0);


  scene.add( player );
  player.add( camera );


  // set angular factor to 0,0,0 to prevent tripping over of player
  player.setAngularFactor(new THREE.Vector3(0,0,0));

  activeObjectPicker = new THREE.Raycaster(player.position, camera.getWorldDirection());

  // IDEA glowwy material, maybe some shaders or deforming shit
  activeMaterial = new THREE.MeshBasicMaterial({ color: 0xbc1a49 });


  boxgeom = new THREE.BoxGeometry( 2, 2, 2, 6, 6, 6 );
  material_standard = new THREE.MeshLambertMaterial({
    side: THREE.DoubleSided,
    ambient:0xee7b09,
    color: 0x999999,
    specular: 0x009900,
    shininess: 10
  });

  material_creator = new THREE.MeshLambertMaterial({
    side: THREE.DoubleSided,
    ambient:0xee7b09,
    color: 0xff0000,
    specular: 0x009900,
    shininess: 10
  });

  material_gravity = new THREE.MeshLambertMaterial({
    side: THREE.DoubleSided,
    ambient:0xee7b09,
    color: 0x00ff00,
    specular: 0x009900,
    shininess: 10
  });



  groundGeometry = new THREE.BoxGeometry( 500, 1, 500 );
  groundMaterial = new THREE.MeshBasicMaterial( {color: 0xacaaaa, side: THREE.DoubleSided} );
  ground = new Physijs.BoxMesh(
    groundGeometry,
    groundMaterial,
    0 // mass
  );
  ground.receiveShadow = false;
  ground.visible = true;
  ground.position.y = -20;
  ground.userData.category = "ground";
  scene.add( ground );
  ground.addEventListener( 'collision', collision);


  // create one platform for starting position
  var platformPosition = new THREE.Vector3();
  platformPosition.copy(player.position);
  platformPosition.y -= 5;
  createPlatform(platformPosition);

  // create two additional platforms
  for (var i = 0; i < 1; i++) {
    var newPosition = new THREE.Vector3(
      THREE.Math.randFloat(-5, -15),
      THREE.Math.randFloat(5, 15),
      THREE.Math.randFloat(-5, -15));
      platformPosition.add(newPosition);

      createPlatform(platformPosition);
    }



  clock = new THREE.Clock(true);
  clock.start();
  requestAnimationFrame(render);
}

  function mutateObject(obj){

    // TODO: use collision normal vecotrs and speed vectors to chose more intelligently
    // which vectors or faces to change on impact.

    // don't manipulate more than 25% of vertices
    var maxAmount = obj.geometry.vertices.length / 4;
    var n = THREE.Math.randInt(0, maxAmount - 1);

    for (var i = 0; i < n; i++) {
      var vertex = obj.geometry.vertices[THREE.Math.randInt(0, maxAmount - 1)];
      var centerDirection = new THREE.Vector3();
      centerDirection.copy(vertex);
      centerDirection.sub(obj.position);
      centerDirection.normalize();
      centerDirection.divideScalar(THREE.Math.randInt(10,25));
      vertex.sub(centerDirection);
    }
    obj.userData.mutationCount++;
    obj.geometry.verticesNeedUpdate = true;
  }


  // this is our draw loop. executed 60 times per second
  function render(){
    createRandomFallingObject(5);
    activeObjectPicker.set(player.position, camera.getWorldDirection());
    makeSteps();
    scene.simulate();
    requestAnimationFrame(render);
    renderer.render(scene, camera);
  }

  function look(){
    camera.rotation.x -= horizontalMovement * 0.002;
    camera.rotation.y -= verticalMovement * 0.002;

    // create raytracer and get active object
    // (later when clicking on active object define action depending on category (blue, green, ...))
    //console.log(activeObjectPicker.ray.origin);

    var intersections = activeObjectPicker.intersectObjects(artefacts, false);
    var intersects = intersections.length > 0; // set to true of intersection exist
    var activeChanged = false;

    // set boolean when either there is now an active object  OR not anymore OR if the active object is a new one
    if ((activeObject === undefined && intersects) || (activeObject !== undefined && intersects === false) ||
      intersects && ( intersections[0].object.id !==  activeObject.id )){

        activeChanged = true;

      }
      // TODO: merge with previous if ^   ?
      if( activeChanged ) {
        // reset previous activeObjects material (state?)
        if (activeObject !== undefined) activeObject.material = preActiveMaterial;

        // set new active object and material if any new
        if( intersects ) {
          // loop all intersection and look for non platform objects
          for (var i = 0; i < intersections.length; i++) {

            if(intersections[i].object.userData.category !== "platform"){
              activeObject = intersections[i].object;
              preActiveMaterial = activeObject.material;
              activeObject.material = activeMaterial;
              break;
            }

          }

        } else {
          activeObject = undefined;
        }
      }


    }

    function jump(){
      player.applyCentralImpulse(new THREE.Vector3(0, 30, 0));

    }

    function makeSteps(){
      if(!moveForward && !moveBackward && !moveLeft && !moveRight){
        // walking ended? -> reset walking height to standard, (only camera movement)
        if(camera.position.y > normalCameraHeight + 0.1)
          camera.position.y -= (THREE.Math.smoothstep(camera.position.y, normalCameraHeight, normalCameraHeight + 2));
          camera.__dirtyPosition = true;
          player.__dirtyPosition = true;
          return;
        } // return if not moved

        // simulate walking with two legs by perlin noise
        // this should be for now only applied to the cam, to avoid falling
        var roughness = new THREE.Vector3(0,0,0);
        var noiseX = perlin.noise( (clock.getElapsedTime() + 123456) * 5, 0, 0) / 40;
        var noiseY = perlin.noise( (clock.getElapsedTime() + 7777777) * 5, 0, 0) / 70;

        roughness.y = (Math.sin(clock.getElapsedTime()*10) / 50) + noiseY;
        roughness.x = (Math.cos(clock.getElapsedTime()*10) / 130) + noiseX;
        camera.position.add(roughness);

        // get normalized looking direction of camera
        // to move player in that direction
        // thanks! -> http://stackoverflow.com/questions/14813902/three-js-get-the-direction-in-which-the-camera-is-looking
        var vector = new THREE.Vector3( 0, 0, -1 );
        vector.applyQuaternion( camera.quaternion );
        //since threejs rev69:  var vector = camera.getWorldDirection();

        vector.y = 0; // we don't want to move vertical, aka climbing a ladder
        vector.divideScalar( 15 );
        if( moveForward ) player.position.add(vector);
        if( moveBackward ) player.position.sub(vector);

        if( moveLeft || moveRight ){
          vector.cross( new THREE.Vector3( 0, 1, 0 ));
          if( moveRight ) player.position.add(vector);
          if( moveLeft ) player.position.sub(vector);
        }

        player.__dirtyPosition = true;
        camera.__dirtyPosition = true;

      }

      function unfreeze(obj){
        obj.setAngularFactor(new THREE.Vector3(1,1,1));
        obj.setLinearFactor(new THREE.Vector3(1,1,1));
      }


      function freeze(obj){
        obj.setAngularFactor(new THREE.Vector3(0,0,0));
        obj.setLinearFactor(new THREE.Vector3(0,0,0));
      }


      function onDocumentMouseDown( event ) {

        if(activeObject !== undefined){
          if(activeObject.userData.category === "gravity object"){
            // apply gravity to all elements within radius
            for (var i = 0; i < artefacts.length; i++) {
              var artefact = artefacts[i];
              // TODO: properly find distance
              var distanceVector = artefact.position.sub(activeObject.position);
              var distance = distanceVector.x + distanceVector.y + distanceVector.z;
              if (distance < 10) {
                // TODO: scale push strength by distance
                artefact.applyCentralImpulse(artefact.position.sub(activeObject.position).normalize().multiplyScalar(15));
              }
            }
          } else if(activeObject.userData.category === "creator object"){
            // action blue
          } else if(activeObject.userData.category === "standard object"){
            activeObject.applyCentralImpulse(camera.getWorldDirection().multiplyScalar(2));

          }
        }
      }


      function onDocumentMouseMove( event ) {

        //TODO: look at some stuff done in: http://threejs.org/examples/js/controls/FirstPersonControls.js
        event.preventDefault();
        // vertical and horizontal movement seems counter intuitive but it is the axes
        // you are rotating along
        verticalMovement = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        horizontalMovement = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        look();
      }

      function createRandomObject(pos){

        var obj;
        var r = THREE.Math.randFloat(0.0, 1.0);

        if(r <= chanceGravity) {
          obj = createGravityObject();
        } else if(r <= chanceCreator){
          obj = createCreatorObject();
        } else {
          obj = createStandardObject();
        }

        obj.position.copy(pos);
        obj.castShadow = false;
        obj.receiveShadow = false;
        obj.userData.mutationCount = 0;

        return obj;
      }

      function createStandardObject() {
        var boxGeometry = new THREE.BoxGeometry(  2, 2, 2, 6, 6, 6 );
        var randomMesh = new Physijs.ConvexMesh( boxGeometry, material_standard, 1 );
        randomMesh.userData.category = "standard object";
        return randomMesh;
      }

      // TODO: strength of objects power by size and color saturation
      function createGravityObject() {
        var boxGeometry = new THREE.BoxGeometry(  2, 2, 2, 6, 6, 6 );
        var randomMesh = new Physijs.ConvexMesh( boxGeometry, material_gravity, 1 );
        randomMesh.userData.category = "gravity object";
        return randomMesh;
      }
      

      function createCreatorObject(pos) {
        var boxGeometry = new THREE.BoxGeometry(  2, 2, 2, 6, 6, 6 );
        var randomMesh = new Physijs.ConvexMesh( boxGeometry, material_creator, 1 );
        randomMesh.userData.category = "creator object";
        return randomMesh;
      }


      function createObjectAtSight(){

        var targetVector = new THREE.Vector3();
        targetVector.copy( camera.position );
        targetVector.add( camera.getWorldDirection().multiplyScalar( 10 ) );
        // now randomize coordinates in spherical boundary

        var newBox = createRandomObject(targetVector);
        // Enable CCD if the object moves more than 1 meter in one simulation frame
        newBox.setCcdMotionThreshold( 1 );

        // Set the radius of the embedded sphere such that it is smaller than the object
        newBox.setCcdSweptSphereRadius( 0.2 );
        newBox.addEventListener( 'collision', collision);


        artefacts.push( newBox );
        scene.add( newBox );
      }

      function createRandomFallingObject(heigth_){
        if( Math.random() * 50 < 1 ) {
          var targetVector = new THREE.Vector3((Math.random() * 20) - 10, heigth_, ( Math.random() * 20 ) - 10 );
          var randomObject = createRandomObject(targetVector);
          randomObject.rotation.x = Math.random();
          randomObject.rotation.y = Math.random();
          randomObject.rotation.z = Math.random();
          randomObject.addEventListener( 'collision', collision);

          // Enable CCD if the object moves more than 1 meter in one simulation frame
          randomObject.setCcdMotionThreshold(1);

          // Set the radius of the embedded sphere such that it is smaller than the object
          randomObject.setCcdSweptSphereRadius(0.2);

          artefacts.push( randomObject );
          scene.add( randomObject );

        }
      }


      function removePlatformsInShadow(){
        var targetVector = new THREE.Vector3();
        targetVector.copy(camera.position);
        targetVector.add(camera.getWorldDirection().multiplyScalar(10));
        // iterate array of added artefacts and randomly delete those with destination < 5
        // with higher probability the smaller the destination
        for (var i = 0; i < artefacts.length; i++) {
          var dest = targetVector.dest(artefacts[i]);
        }
      }

      function collision( other_object, relative_velocity, relative_rotation, contact_normal ){
        //console.log("collision...");

        //console.log(this.userData.category + "collision detected. with: " + other_object.userData.category);

        if(this.userData.category == "ground" && other_object.userData.category != "player"){
          console.log("hit ground. remove it.");
          scene.remove(other_object);
          //other_object.geometry.dispose(); will remove geometry,
          //bad for stuff with identical geometry like platforms
          //

          // mutate if not ground, not player, and not two platform elements
          // and mutation count is low enough
        } else if (this.userData.category != "ground" && this.userData.category != "player" &&
          !(this.userData.category == "platform" && other_object.userData.category == "platform") &&
          this.userData.mutationCount < 10){
          console.log("mutate object: " + this.userData.category);
          mutateObject(this);
        }


      }

      function createPlatform(pos){

        // TODO: rotated plane instead of normale plane
        var elementWidth = 10;
        var geometry = new THREE.BoxGeometry(elementWidth, 1, elementWidth);
        var y = 0.0;

        // generate a field of boxes
        for (var x = -3; x < 3; x++) {
          y += 0.5;
          for (var z = -3; z < 3; z++) {
            var platformElement = new Physijs.BoxMesh( geometry, material_standard );

            platformElement.position.set(
              (x * elementWidth) + THREE.Math.randFloat(1, 1.8),
              y + THREE.Math.randFloat( -0.3, 0.3 ),
              (z * elementWidth) + THREE.Math.randFloat(1, 1.8) );

            platformElement.position.add(pos);
            platformElement.userData.category = "platform";
            artefacts.push(platformElement);
            player.__dirtyPosition = true;

            scene.add(platformElement);
            freeze(platformElement);
          }
        }
      }




      function onKeyDown ( event ) {
        //via: http://threejs.org/examples/js/controls/FirstPersonControls.js
        //event.preventDefault();

        switch ( event.keyCode ) {

          case 38: /*up*/
          case 87: /*W*/ moveForward = true; break;

          case 37: /*left*/
          case 65: /*A*/ moveLeft = true; break;

          case 40: /*down*/
          case 83: /*S*/ moveBackward = true; break;

          case 39: /*right*/
          case 68: /*D*/ moveRight = true; break;

          case 32:  /* SPACE */ jump(); break;
        }
      };

      function onKeyUp ( event ) {
        //via: http://threejs.org/examples/js/controls/FirstPersonControls.js
        switch( event.keyCode ) {

          case 38: /*up*/
          case 87: /*W*/ moveForward = false; break;

          case 37: /*left*/
          case 65: /*A*/ moveLeft = false; break;

          case 40: /*down*/
          case 83: /*S*/ moveBackward = false; break;

          case 39: /*right*/
          case 68: /*D*/ moveRight = false; break;

        }

      };

      window.onload = init;
