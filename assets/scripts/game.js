"use strict";

/***********\
| CONSTANTS |
\***********/

var SCREEN_WIDTH = 312;
var SCREEN_HEIGHT = 160;
var MAX_SWIPE_SPEED = 500;
var MIN_SWIPE_SPEED = 10;
var SWIPE_MULTIPLIER = Math.floor(window.innerWidth / 200);
var START_BOMBS = 8
var BOMB_MULTIPLIER = 0.2;
var DIFFICULTY_INCREASE = 20;
var START_DIFFICULTY = 10;
var EXTRA_LIFE_INCREMENT = 1000; //the score required to get an extra life increases by this each time you get one
var BUCKET_DRAG = 300;

/***********\
| VARIABLES |
\***********/

//GAME
var game = new Phaser.Game(SCREEN_WIDTH, SCREEN_HEIGHT, Phaser.CANVAS, "kibel",
	{preload: preload, create: create, update: update});


//GAME OBJECTS
var bomber;
var bucket;
var bombs;
var grass;

//TIMERS
var bombTimer;

//PARAMETERS
var difficulty = START_DIFFICULTY;
var score = 0;
var highScore = 0;
var scoreToExtraLife;
var extraLives;
var extraLifeAcquired;

//FLAGS
var isGameOver;
var isRoundOn = false;
var isLosingLife = false;
var isBetterScore;
var isGameOn = false;


//STORAGE
var savedScore;
var localStorageName = "kapow_high_score";

//TEXT OBJECTS
var scoreText;
var highScoreText;
var title;
var credits;


/******\
| MAIN |
\******/

function preload() {
	loadAssets();
	enableCrispRendering();
}

function create () {
	adjustGameScale();
    initializeSounds();
	createBackground();
	createBomber();
	createBucket();
	initializeBucketAnimation();
	initializeVariables();
	adjustBucketCollisionMask();
	initializeBucketMovement();
	createBombs();
	createScoreText();
	loadHighScore();
	createHighScoreText();
	showCredits();
	adjustText();
}

function update () {
	bounceBomber();
	checkNextRound();
	checkBombs();
	checkCollisions();
	addExtraLife();
}

/***********\
| FUNCTIONS |
\***********/

function loadAssets () {
	game.load.spritesheet("bomber", "assets/sprites/bomber_strip2.png", 16, 32, 2);
	game.load.spritesheet("bucket", "assets/sprites/bucket_strip3.png", 16, 32, 3);
	game.load.spritesheet("bomb", "assets/sprites/bomb_strip2.png", 8, 8, 2);

	game.load.image("grass", "assets/sprites/b_grass.png", 64, 64);

	game.load.audio("throw", ["assets/sounds/a_throw.ogg", "assets/sounds/a_throw.mp3"]);
	game.load.audio("gulp", ["assets/sounds/a_gulp.ogg", "assets/sounds/a_gulp.mp3"]);
	game.load.audio("kaboom", ["assets/sounds/a_kaboom.ogg", "assets/sounds/a_kaboom.mp3"]);
	game.load.audio("extra", ["assets/sounds/a_extra.ogg", "assets/sounds/a_extra.mp3"]);
	game.load.audio("hiscore", ["assets/sounds/a_hiscore.ogg", "assets/sounds/a_hiscore.mp3"]);

	game.load.bitmapFont("font", "assets/fonts/font.png", "assets/fonts/font.fnt");
}

function enableCrispRendering () {
	game.renderer.renderSession.roundPixels = true;
	Phaser.Canvas.setImageRenderingCrisp(game.canvas);
	game.stage.backgroundColor = "#00ccff";
}

function initializeVariables () {
	//the current bucket frame is used both to display the correct number of buckets and as a life counter
	bucket.animations.frame = 2;
	bucket.relativeX = bucket.x;
	bucket.canSwipe = false;
	bucket.visible = true;
	isGameOver = false;
	isBetterScore = false;
	score = 0;
	scoreToExtraLife = 0;
	extraLives = 0;
	extraLifeAcquired = 5000;
	difficulty = START_DIFFICULTY;

}

function adjustGameScale () {
	game.scale.pageAlignHorizontally = true;
    game.scale.pageAlignVertically = true;
	game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
}

function initializeSounds () {
	game.throwSound = game.add.audio("throw");
    game.gulpSound = game.add.audio("gulp");
    game.kaboomSound = game.add.audio("kaboom");
    game.extraSound = game.add.audio("extra");
    game.hiscoreSound = game.add.audio("hiscore");
}

function createBackground () {
	grass = game.add.sprite(0, 16, "grass");
	grass.width = SCREEN_WIDTH;
	grass.height = SCREEN_HEIGHT;
}

function createBomber () {
	bomber = game.add.sprite(132, 16, "bomber");
	game.physics.enable(bomber, Phaser.Physics.ARCADE);
	bomber.anchor.setTo(0.5);
	bomber.animations.add("idle", [0]);
	bomber.animations.add("smiling", [1]);
	bomber.animations.play("idle");
	bomber.isMoving = false; //flag to check whether the bomber is currently dropping bombs
}

function createBucket () {
	bucket = game.add.sprite(132, 108, "bucket");
	game.physics.enable(bucket, Phaser.Physics.ARCADE);
	bucket.anchor.setTo(0.5);
	bucket.body.collideWorldBounds = true;
	bucket.body.drag.x = BUCKET_DRAG;
	bucket.body.immovable = true;
}

function initializeBucketAnimation () {
	bucket.animations.add("idle", [0, 1, 2], 0);
	bucket.animations.play("idle");
}

function adjustBucketCollisionMask () {
	bucket.body.setSize(bucket.width, bucket.height - (2-bucket.animations.frame) * 9 - 10, 0, (2-bucket.animations.frame) * 9 + 10);
}

function initializeBucketMovement () {
	game.canvas.addEventListener('mousedown', requestLock);
    game.input.addMoveCallback(move, this);
    game.input.onDown.add(startRound, this); //start game on touch
    resetTouchOnUp();  //if the player lifts their finger, we need to reset the relative position variable used for swiping, so that the touch works no matter where they put their finger again
}

function createBombs () {
	bombs = game.add.group();
	setBombCount();
}

function createScoreText () {
	scoreText = game.add.bitmapText(SCREEN_WIDTH / 2 - 32, SCREEN_HEIGHT - 16, "font", score.toString(), 8);
	scoreText.anchor.setTo(0.5);
	scoreText.flashing = game.add.tween(scoreText).to({
		alpha: 0
	}, 500, "Linear", true, 0, -1, true);
}

function loadHighScore () {
	savedScore = localStorage.getItem(localStorageName) == null ? {score: 0} : JSON.parse(localStorage.getItem(localStorageName));
	highScore = savedScore.score;
}

function createHighScoreText () {
	highScoreText = game.add.bitmapText(SCREEN_WIDTH / 2 + 32, SCREEN_HEIGHT - 16, "font", highScore.toString(), 8);
	highScoreText.anchor.setTo(0.5);
	highScoreText.flashing = game.add.tween(highScoreText).to({
		alpha: 0
	}, 500, "Linear", true, 0, -1, true);
}

function showCredits () {
	title = game.add.bitmapText(SCREEN_WIDTH / 2, 40, "font", "KAPOW!", 16);
	title.anchor.setTo(0.5);
	credits = game.add.bitmapText(SCREEN_WIDTH / 2, 60, "font", "gfx, snd & prg - matzieq", 8);
	credits.anchor.setTo(0.5);
}

function checkCollisions () {
	//bucket catching bombs
	game.physics.arcade.collide(bucket, bombs, null, function(bucket, bomb) { 
		game.gulpSound.play();
		adjustScore();
		checkHighScore();
		adjustText();
		checkExtraLife();		
		bomb.kill(); //changed destroy to kill
	}, this);
}

function adjustScore () {
	score += difficulty;
	scoreToExtraLife += difficulty;
}

function checkHighScore () {
	if (score >= highScore) {
		highScore = score;
		isBetterScore = true;
	}
}

function adjustText () {
	highScoreText.flashing.pause();
	highScoreText.alpha = 0.5;
	scoreText.flashing.pause();
	scoreText.alpha = 1;
	scoreText.text = score.toString();
	highScoreText.text = highScore.toString();
}

function checkExtraLife () {
	if (scoreToExtraLife >= extraLifeAcquired) {
		scoreToExtraLife -= extraLifeAcquired;
		extraLives++;
		extraLifeAcquired += EXTRA_LIFE_INCREMENT;
		game.extraSound.play();
		game.add.tween(scoreText).to({ alpha: 0 }, 10, "Linear", true, 0, 10, true); //flashing score text
	}
}

function addExtraLife () {
	if (extraLives > 0 && bucket.animations.frame < 2) {
		extraLives--;
		bucket.animations.frame++;
		adjustBucketCollisionMask();
		game.add.tween(bucket).to({ alpha: 0.5}, 100, "Linear", true, 0, 1, true);
		game.extraSound.play();
	}
}

function resetTouchOnUp () {
	game.input.onUp.add(function () {
		bucket.relativeX = bucket.x;
		if (bucket.relativeX < 0) { //
		} else if (bucket.relativeX > SCREEN_WIDTH) {
			bucket.relativeX = SCREEN_WIDTH;
		}
    	bucket.canSwipe = false;
    }, this);
}

function requestLock() {
    game.input.mouse.requestPointerLock();
}

function move(pointer, x, y, click) {
	bucket.body.velocity.x = 0;
    //  If the cursor is locked to the game, and the callback was not fired from a 'click' event
    //  (such as a mouse click or touch down) - as then it might contain incorrect movement values
    if (Phaser.Device.desktop && game.input.mouse.locked && !click) {
		//mouse clamping
        bucket.x += game.input.mouse.event.movementX / 2;
    } else if (!game.device.desktop && bucket.canSwipe) {
		//swipe movement
    	var swipeDistance = game.input.activePointer.position.x - game.input.activePointer.positionDown.x;
		bucket.x = bucket.relativeX + swipeDistance * SWIPE_MULTIPLIER;
    }
}

function startRound() {
	if (!isRoundOn && !isGameOver && !bomber.isMoving) {
		isRoundOn = true;
		initializeBomberMovement();
		setBombCount();
		setBombTimer();
	} else if (isGameOver) {
		initializeVariables();
		adjustText();
		adjustBucketCollisionMask();
		loadHighScore();
	}

	bucket.canSwipe = true;

	//after first click or touch
	if (!isGameOn) {
		removeCredits();
		isGameOn = true;		
	}
}

function initializeBomberMovement () {
	bomber.isMoving = true;
	bomber.animations.play("idle");
}

function setBombCount () {
	bombs.bombCount = difficulty * BOMB_MULTIPLIER + START_BOMBS;
}

function setBombTimer () {
	bombTimer = game.time.create(true);
	bombTimer.repeat(200, bombs.bombCount, dropBomb, this);
	bombTimer.start();
}

function removeCredits () {
	game.add.tween(title).to({
		x: -100, 
		y: -200
	   }, 500, "Linear", true);
   game.add.tween(credits).to({
	   x: 500, 
	   y: 700
	   }, 500, "Linear", true);
}

function dropBomb () {
	game.throwSound.play();
	//recycle or create a bomb, add it to group and send it flying down
	var bomb = bombs.getFirstExists(false);
	if (!bomb) {
		bomb = game.add.sprite(0, 0, "bomb");
		game.physics.enable(bomb, Phaser.Physics.ARCADE);
		bomb.animations.add("idle", [0, 1], 30, true);
		bomb.animations.play("idle");
		bomb.anchor.setTo(0.5);
		bombs.add(bomb);
	}
	bomb.reset(bomber.x, bomber.y + 8);
	bomb.body.velocity.y = 50 + difficulty;

	changeBomberMovementDirection();
}

function changeBomberMovementDirection () {
	if (game.rnd.integerInRange(0, 1) === 1) {
		bomber.body.velocity.x = 50 + difficulty;
	} else {
		bomber.body.velocity.x = -50 - difficulty;
	}
	bombs.bombCount--;	
}

function bounceBomber () {
	if ((bomber.x < 12 && bomber.body.velocity.x < 0) || (bomber.x > SCREEN_WIDTH - 12 && bomber.body.velocity.x > 0)) {
		bomber.body.velocity.x *= -1;
	}
}

function checkNextRound () {
	if (bombs.bombCount <= 0 && isRoundOn) {
		endRound();
	}
	if (isLosingLife) { 
		isLosingLife = false;
		bomber.animations.play("smiling");
		game.kaboomSound.play();
		destroyAllBombs();
		reduceLives();		
		adjustDifficulty();		
	}
}

function destroyAllBombs () {
	bombs.forEach (function (bomb) {
		bomb.kill();
	});
	bombTimer.pause();
}

function endRound () {
	isRoundOn = false;
	bomber.isMoving = false;
	if (difficulty <= 180) {
		difficulty += DIFFICULTY_INCREASE;
	}
	bomber.body.velocity.x = 0;
}

function reduceLives () {
	if (bucket.animations.frame > 0) { //the number of lives is kept in the animation frame. 
		bucket.animations.frame --;
		adjustBucketCollisionMask();
	} else {
		isGameOver = true;
		bucket.visible = false;
		if (isBetterScore) {
			flashHighScore();
		}
		saveHighScore();
	}
}

function flashHighScore () {
	highScoreText.flashing.resume();
	scoreText.flashing.resume();
	game.hiscoreSound.play();
}

function saveHighScore () {
	highScore = Math.max(score, savedScore.score);
	//highScore = 0; //debug
	localStorage.setItem(localStorageName, JSON.stringify({
		score: highScore
	}));
}

function adjustDifficulty () {
	if (difficulty > 2 * DIFFICULTY_INCREASE) {
		difficulty -= DIFFICULTY_INCREASE * 2;
	} else {
		difficulty = START_DIFFICULTY;
	}
}

function checkBombs () {
	bombs.forEach (function (bomb) {
		if (bomb.y > SCREEN_HEIGHT) {
			bomb.kill();
			bomb.y = 0;
			isLosingLife = true;
			bombs.bombCount = 0;
		}
	});
}