"use strict";

var SCREEN_WIDTH = 312;
var SCREEN_HEIGHT = 160;
var MAX_SWIPE_SPEED = 500;
var MIN_SWIPE_SPEED = 10;
var SWIPE_MULTIPLIER = Math.floor(window.innerWidth / 200);
var START_BOMBS = 8
var BOMB_MULTIPLIER = 0.2;
var DIFFICULTY_INCREASE = 20;
var START_DIFFICULTY = 1;


var game = new Phaser.Game(SCREEN_WIDTH, SCREEN_HEIGHT, Phaser.CANVAS, "kibel",
	{preload: preload, create: create, update: update});

var bomber;
var bucket;
var bombs;
var bombTimer;
var difficulty = START_DIFFICULTY;
var isGameOver = false;
var isRoundOn = false;
var isLosingLife = false;
var isBetterScore = false;

var score = 0;
var highScore = 0;
var scoreToExtraLife = 0;
var extraLives = 0;
var scoreText;
var highScoreText;
var extraLifeAcquired = 5000;

var savedScore;
var localStorageName = "high_score";

function preload() {
	game.load.spritesheet("bomber", "assets/sprites/bomber_strip2.png", 16, 32, 2);
	game.load.spritesheet("bucket", "assets/sprites/bucket_strip3.png", 16, 32, 3);
	game.load.spritesheet("bomb", "assets/sprites/bomb_strip2.png", 8, 8, 2);
	game.load.image("grass", "assets/sprites/b_grass.png", 64, 64);
	game.load.audio("throw", "assets/sounds/a_throw.ogg", "assets/sounds/a_throw.mp3");
	game.load.audio("gulp", "assets/sounds/a_gulp.ogg", "assets/sounds/a_gulp.mp3");
	game.load.audio("kaboom", "assets/sounds/a_kaboom.ogg", "assets/sounds/a_kaboom.mp3");
	game.load.audio("extra", "assets/sounds/a_extra.ogg", "assets/sounds/a_extra.mp3");
	game.load.audio("hiscore", "assets/sounds/a_hiscore.ogg", "assets/sounds/a_hiscore.mp3");
	game.load.bitmapFont("font", "assets/fonts/font.png", "assets/fonts/font.fnt");

	// enable crisp rendering
	game.renderer.renderSession.roundPixels = true;
	Phaser.Canvas.setImageRenderingCrisp(game.canvas);
	game.stage.backgroundColor = "#00ccff";
}

function create () {

	//technical stuff
	game.scale.pageAlignHorizontally = true;
    game.scale.pageAlignVertically = true;
	game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;

    //initializing sounds
    game.throwSound = game.add.audio("throw");
    game.gulpSound = game.add.audio("gulp");
    game.kaboomSound = game.add.audio("kaboom");
    game.extraSound = game.add.audio("extra");
    game.hiscoreSound = game.add.audio("hiscore");
	
	//creating grass background
	var grass = game.add.sprite(0, 16, "grass");
	grass.width = SCREEN_WIDTH;
	grass.height = SCREEN_HEIGHT;

	//creating bomber
	bomber = game.add.sprite(132, 16, "bomber");
	game.physics.enable(bomber, Phaser.Physics.ARCADE);
	bomber.anchor.setTo(0.5);
	bomber.animations.add("idle", [0]);
	bomber.animations.add("smiling", [1]);
	bomber.animations.play("idle");
	bomber.isMoving = false; //flag to check whether the bomber is currently dropping bombs
	

	//creating bucket
	bucket = game.add.sprite(132, 108, "bucket");
	game.physics.enable(bucket, Phaser.Physics.ARCADE);
	bucket.anchor.setTo(0.5);
	bucket.body.collideWorldBounds = true;
	bucket.body.drag.x = 300;
	bucket.body.immovable = true;

	//the bucket sprite has some space on the top, we need to counteract that
	bucket.body.setSize(bucket.width, bucket.height - 10, 0, 10) 
	bucket.animations.add("idle", [0, 1, 2], 0);
	bucket.animations.play("idle");

	//the current frame is used both to display the correct number of buckets and as a life counter
	bucket.animations.frame = 2;	

	bucket.relativeX = bucket.x;
	bucket.canSwipe = false;

	//setting up bucket movement
	game.canvas.addEventListener('mousedown', requestLock);
    game.input.addMoveCallback(move, this);
    game.input.onDown.add(startRound, this);
    game.input.onUp.add(function () {
    	bucket.relativeX = bucket.x;
    	bucket.canSwipe = false;
    }, this);

    bombs = game.add.group();
    bombs.bombCount = difficulty * BOMB_MULTIPLIER + START_BOMBS; //this many per round

    scoreText = game.add.bitmapText(SCREEN_WIDTH / 2 - 32, SCREEN_HEIGHT - 16, "font", score.toString(), 8);
	scoreText.anchor.setTo(0.5);
	scoreText.flashing = game.add.tween(scoreText).to({
		alpha: 0
	}, 500, "Linear", true, 0, -1, true);
	scoreText.flashing.pause();
	
	savedScore = localStorage.getItem(localStorageName) == null ? {score: 0} : JSON.parse(localStorage.getItem(localStorageName));
	highScore = savedScore.score;
	highScoreText = game.add.bitmapText(SCREEN_WIDTH / 2 + 32, SCREEN_HEIGHT - 16, "font", highScore.toString(), 8);
	highScoreText.anchor.setTo(0.5);
	highScoreText.alpha = 0.5;
	highScoreText.flashing = game.add.tween(highScoreText).to({
		alpha: 0
	}, 500, "Linear", true, 0, -1, true);
	highScoreText.flashing.pause();
	//highScoreText.tint = 0x444;
}

function update () {
	//console.log(isRoundOn);
	bounce (bomber);
	checkNextRound();
	checkBombs();
	game.physics.arcade.collide(bucket, bombs, null, function(bucket, bomb) {
		game.gulpSound.play();
		score += difficulty;
		scoreToExtraLife += difficulty;
		if (score >= highScore) {
			highScore = score;
			isBetterScore = true;
		}
		//console.log("Score: " + scoreText.text + " vs " + score);
		//console.log("High Score: " + highScoreText.text + " vs " + highScore);
		scoreText.text = score.toString();
		highScoreText.text = highScore.toString();
		if (scoreToExtraLife >= extraLifeAcquired) {
			scoreToExtraLife -= extraLifeAcquired;
			extraLives++;
			extraLifeAcquired += 1000;
			game.extraSound.play();
			game.add.tween(scoreText).to({ alpha: 0 }, 10, "Linear", true, 0, 10, true);
		}
		bomb.destroy();
	}, this);

	if (extraLives > 0 && bucket.animations.frame < 2) {
		extraLives--;
		bucket.animations.frame++;
		bucket.body.setSize(bucket.width, bucket.height - (2-bucket.animations.frame) * 9 - 10, 0, (2-bucket.animations.frame) * 9 + 10);
		game.extraSound.play();
	}
	
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
    	console.log("Relative X: " + bucket.relativeX);
    	console.log("Swipedist: " + swipeDistance);
	    	bucket.x = bucket.relativeX + swipeDistance * SWIPE_MULTIPLIER;
    }
}

function startRound() {
	if (!isRoundOn && !isGameOver && !bomber.isMoving) {
		bomber.isMoving = true;
		bomber.animations.play("idle");
		isRoundOn = true;
		bombs.bombCount = difficulty * BOMB_MULTIPLIER + START_BOMBS;
		bombTimer = game.time.create(true);
		bombTimer.repeat(200, bombs.bombCount, createBomb, this);
		bombTimer.start();

	} else if (isGameOver) {
		bucket.visible = true;
		highScoreText.flashing.pause();
		highScoreText.alpha = 0.5;
		scoreText.flashing.pause();
		scoreText.alpha = 1;
		score = 0;
		scoreText.text = score.toString();
		scoreToExtraLife = 0;
		extraLives = 0;
		extraLifeAcquired = 5000;
		bucket.animations.frame = 2;
		bucket.body.setSize(bucket.width, bucket.height - (2-bucket.animations.frame) * 9 - 10, 0, (2-bucket.animations.frame) * 9 + 10);
		isGameOver = false;
		isBetterScore = false;
		savedScore = localStorage.getItem(localStorageName) == null ? {score: 0} : JSON.parse(localStorage.getItem(localStorageName));
		highScore = savedScore.score;
	}
	bucket.canSwipe = true;
}

function createBomb () {
	game.throwSound.play();
	var bomb = game.add.sprite(bomber.x, bomber.y + 8, "bomb");
	game.physics.enable(bomb, Phaser.Physics.ARCADE);
	bomb.body.velocity.y = 50 + difficulty;
	bomb.animations.add("idle", [0, 1], 30, true);
	bomb.animations.play("idle");
	bomb.anchor.setTo(0.5);
	bombs.add(bomb);
	if (game.rnd.integerInRange(0, 1) === 1) {
		bomber.body.velocity.x = 50 + difficulty;
	} else {
		bomber.body.velocity.x = -50 - difficulty;
	}
	bombs.bombCount--;			
	
	//this is to reset the bomb counter after the player loses a life
	if (bombs.length == 0) {
		bombs.bombCount = 0;
	}
}

function bounce (spr) {
	if ((spr.x < 8 && spr.body.velocity.x < 0) || (spr.x > SCREEN_WIDTH - 8 && spr.body.velocity.x > 0)) {
		spr.body.velocity.x *= -1;
	}
}

function checkNextRound () {
	if (bombs.length == 0 && bombs.bombCount <= 0 && isRoundOn) {
		isRoundOn = false;
		bomber.isMoving = false;
		if (difficulty <= 180) {
			difficulty += DIFFICULTY_INCREASE;
			console.log("Difficulty: " + difficulty);
		}
		bomber.body.velocity.x = 0;
		if (isLosingLife) { 
			isLosingLife = false;
			bomber.animations.play("smiling");
			//Phaser.Camera.shake();
			game.kaboomSound.play();
			if (bucket.animations.frame > 0) {
				bucket.animations.frame --;
				bucket.body.setSize(bucket.width, bucket.height - (2-bucket.animations.frame) * 9 - 10, 0, (2-bucket.animations.frame) * 9 + 10);
			} else {
				isGameOver = true;
				bucket.visible = false;
				if (isBetterScore) {
					highScoreText.flashing.resume();
					scoreText.flashing.resume();
					game.hiscoreSound.play();
				}
				highScore = Math.max(score, savedScore.score);
				console.log(highScore);
				//highScore = 0; //debug
                localStorage.setItem(localStorageName, JSON.stringify({
                    score: highScore
                }));
			}
			if (difficulty > 2 * DIFFICULTY_INCREASE) {
				difficulty -= DIFFICULTY_INCREASE * 2;
			} else {
				difficulty = START_DIFFICULTY;
			}
		}
	}
}

function checkBombs () {
	bombs.forEach (function (bomb) {
		if (bomb.y > SCREEN_HEIGHT) {
			bomb.destroy();
			isLosingLife = true;
		}
	});
	if (isLosingLife) {
		bombs.forEach (function (bomb) {
			bomb.destroy();
			bombs.bombCount--;
		});
		bombTimer.pause();
		bombs.bombCount = 0;
		//isLosingLife = false;
		//console.log("Losing! " + bombs.length + "Bomb count: " + bombs.bombCount);
	}
}