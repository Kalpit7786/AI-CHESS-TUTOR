// Helper Function for Sleek Notifications (Global)
function showToast(message, isError = false) {
    if (isError) {
        $("#liveToast").removeClass("text-bg-success").addClass("text-bg-danger");
    } else {
        $("#liveToast").removeClass("text-bg-danger").addClass("text-bg-success");
    }
    $("#toastMessage").text(message);
    var toastEl = document.getElementById('liveToast');
    if (toastEl) {
        var toast = new bootstrap.Toast(toastEl);
        toast.show();
    }
}

// Wait for the HTML document to fully load before running the script
$(document).ready(function() {

    // --- UI: Toggle Password Visibility ---
    $("#togglePassword").click(function() {
        var passwordField = $("#passwordInput");
        if (passwordField.attr("type") === "password") {
            passwordField.attr("type", "text");
            $(this).text("Hide");
        } else {
            passwordField.attr("type", "password");
            $(this).text("Show");
        }
    });

    // --- User Profile & Authentication Logic ---
    var storedData = localStorage.getItem("chessUser");
    if (storedData) {
        var userData = JSON.parse(storedData);
        if ($("#profileName").length) {
            $("#profileName").text(userData.fullName);
            $("#profileEmail").text(userData.email);
        }
        $("#navLoginItem").hide();
    } else {
        if ($("#profileName").length) {
            alert("Please log in to view your profile.");
            window.location.href = "login.html";
        }
    }

    $("#logoutBtn").click(function() {
        localStorage.removeItem("chessUser");
        alert("You have been logged out.");
        window.location.href = "index.html";
    });

    // --- Live Search Filter for Lessons ---
    $("#lessonSearch").on("keyup", function() {
        var value = $(this).val().toLowerCase();
        $(".lesson-card").filter(function() {
            $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
        });
    });

    // --- Registration Form Validation ---
    $("#registerForm").submit(function(event) {
        event.preventDefault(); 
        var password = $("#regPasswordInput").val();
        var confirmPassword = $("#confirmPasswordInput").val();
        var isValid = true;

        if (password.length < 8) {
            $("#lengthError").show(); 
            isValid = false;          
        } else {
            $("#lengthError").hide(); 
        }

        if (password !== confirmPassword) {
            $("#matchError").show(); 
            isValid = false;         
        } else {
            $("#matchError").hide(); 
        }

        if (isValid === true) {
            var newUserData = {
                fullName: $("#nameInput").val(),
                email: $("#emailInput").val(),
                password: password 
            };
            localStorage.setItem("chessUser", JSON.stringify(newUserData));
            showToast("Account created successfully! Redirecting to login...");
            setTimeout(function() {
                window.location.href = "login.html";
            }, 2000); 
        }
    });

    // --- Login Form Logic ---
    $("#loginForm").submit(function(event) {
        event.preventDefault(); 
        var enteredEmail = $("#emailInput").val();
        var enteredPassword = $("#passwordInput").val();
        var localData = localStorage.getItem("chessUser");

        if (localData) {
            var parsedData = JSON.parse(localData);
            if (enteredEmail === parsedData.email && enteredPassword === parsedData.password) {
                $("#loginError").hide();
                showToast("Welcome back, " + parsedData.fullName + "!");
                setTimeout(function() {
                    window.location.href = "play.html"; 
                }, 1500);
            } else {
                $("#loginError").show();
            }
        } else {
            showToast("No account found. Please register first.", true);
            setTimeout(function() {
                window.location.href = "register.html";
            }, 2000);
        }
    });

    // ==========================================
    // --- MAIN CHESSBOARD (Screen 2: Play AI)---
    // ==========================================
    if ($("#myBoard").length) {
        
        var board = null;
        var game = new Chess();
        var pendingPromotionMove = null; 
        var moveSound = new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3');

        // Load User Data for the Badge
        if (storedData) {
            var uData = JSON.parse(storedData);
            $("#playerNameDisplay").text("👤 " + uData.fullName);
        }

        function updateStatus() {
            var statusStr = '';
            var moveColor = (game.turn() === 'w') ? 'White' : 'Black';

            if (game.in_checkmate()) {
                statusStr = 'Game over, ' + moveColor + ' is in checkmate!';
            } else if (game.in_draw()) {
                statusStr = 'Game over, drawn position.';
            } else {
                statusStr = moveColor + ' to move.';
                if (game.in_check()) statusStr += ' Watch out, ' + moveColor + ' is in check!';
            }
            
            $("#aiMessage").text(statusStr);

            // History Box logic
            var history = game.history({ verbose: true }); 
            var historyText = "";
            var pieceNames = { 'p': 'Pawn', 'n': 'Knight', 'b': 'Bishop', 'r': 'Rook', 'q': 'Queen', 'k': 'King' };

            for (var i = 0; i < history.length; i += 2) {
                historyText += (i / 2 + 1) + ". ";
                var wMove = history[i];
                historyText += wMove.to + "(" + pieceNames[wMove.piece] + ") ";
                if (history[i + 1]) {
                    var bMove = history[i + 1];
                    historyText += bMove.to + "(" + pieceNames[bMove.piece] + ")<br>";
                } else {
                    historyText += "<br>";
                }
            }
            
            $("#moveHistory").html(historyText);
            var historyDiv = document.getElementById("moveHistory");
            if (historyDiv) historyDiv.scrollTop = historyDiv.scrollHeight;
        }

        // Local AI Engine (Beginner & Medium)
        function getBestMove() {
            var possibleMoves = game.moves({ verbose: true });
            if (possibleMoves.length === 0) return null;

            var difficulty = $("#difficultyLevel").val();

            if (difficulty === "Beginner") {
                var randomIdx = Math.floor(Math.random() * possibleMoves.length);
                return possibleMoves[randomIdx].san;
            }

            var bestMove = null;
            var highestValue = -1;
            var pieceValues = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 100 };

            for (var i = 0; i < possibleMoves.length; i++) {
                var localMove = possibleMoves[i];
                if (localMove.captured) {
                    var value = pieceValues[localMove.captured];
                    if (value > highestValue) {
                        highestValue = value;
                        bestMove = localMove.san;
                    }
                }
            }

            if (bestMove === null) {
                var rIdx = Math.floor(Math.random() * possibleMoves.length);
                bestMove = possibleMoves[rIdx].san;
            }
            return bestMove;
        }

        // Async AI Engine (Calls Stockfish API for Hard mode)
      async function makeAIMove() {
            var difficulty = $("#difficultyLevel").val();
            
            var searchDepth = 2; 
            
            if (difficulty === "Medium") {
                searchDepth = 8;
            } else if (difficulty === "Hard") {
                searchDepth = 15; 
            }

            try {
                var currentFen = game.fen();
                var apiUrl = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(currentFen)}&depth=${searchDepth}`;
                
                var response = await fetch(apiUrl);
                var data = await response.json();
                
                if (data.success) {
                    var bestMoveStr = data.bestmove.split(" ")[1]; 
                    executeMove(bestMoveStr, true); 
                } else {
                    executeMove(getBestMove()); 
                }
            } catch (error) {
                console.error("API failed, falling back.");
                executeMove(getBestMove());
            }
        }

        function executeMove(moveData, isRawCoord = false) {
            if (moveData) {
                if (isRawCoord) {
                    var fromSq = moveData.substring(0, 2);
                    var toSq = moveData.substring(2, 4);
                    var promotionPiece = moveData.length > 4 ? moveData.substring(4, 5) : 'q';
                    game.move({ from: fromSq, to: toSq, promotion: promotionPiece });
                } else {
                    game.move(moveData); 
                }
                
                board.position(game.fen());
                moveSound.play(); 
                updateStatus();
            }
        }

        // --- THE UNIFIED ON-DROP FUNCTION ---
        function onDrop(source, target) {
            var move = game.move({ from: source, to: target, promotion: 'q' });
            
            if (move === null) return 'snapback';

            if (move.promotion) {
                game.undo(); 
                pendingPromotionMove = { from: source, to: target };
                $("#promotionModal").modal('show');
                return; 
            }

            moveSound.play(); 
            updateStatus();

            if (game.game_over()) return; 

            var difficulty = $("#difficultyLevel").val();
            var aiThinkingTime = 500; 
            if (difficulty === "Hard") {
                aiThinkingTime = 1500; 
                $("#aiMessage").text("Grandmaster AI is thinking...");
            } else {
                $("#aiMessage").text("AI is thinking...");
            }
            
            window.setTimeout(makeAIMove, aiThinkingTime);
        }

        $(".promo-btn").click(function() {
            var chosenPiece = $(this).data("piece"); 
            $("#promotionModal").modal('hide');
            
            var pMove = game.move({ 
                from: pendingPromotionMove.from, 
                to: pendingPromotionMove.to, 
                promotion: chosenPiece 
            });

            if (pMove) {
                board.position(game.fen());
                moveSound.play();
                updateStatus();
                
                if (!game.game_over()) {
                    var difficulty = $("#difficultyLevel").val();
                    $("#aiMessage").text(difficulty === "Hard" ? "Stockfish Supercomputer is calculating..." : "AI is thinking...");
                    setTimeout(makeAIMove, 250);
                }
            }
            pendingPromotionMove = null;
        });

        function onDragStart (source, piece, position, orientation) {
            if (game.game_over()) return false;
            if ((orientation === 'white' && piece.search(/^b/) !== -1) ||
                (orientation === 'black' && piece.search(/^w/) !== -1)) {
                return false;
            }
        }

        function onSnapEnd () { 
            board.position(game.fen()); 
        }

        var boardConfig = {
            draggable: true,
            position: 'start',
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd,
            pieceTheme: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/merida/{piece}.svg'
        };

        board = Chessboard('myBoard', boardConfig);
        updateStatus(); 

        $("#startBtn").click(function() {
            game.reset();
            board.start();
            updateStatus();
        });

        $("#undoBtn").click(function() {
            game.undo(); 
            game.undo(); 
            board.position(game.fen()); 
            updateStatus(); 
        });

        $("#clearBtn").click(function() {
            game.clear();
            board.clear();
            $("#aiMessage").text("Board cleared.");
            $("#moveHistory").html("");
        });

        $("#flipBtn").click(function() {
            board.flip();
        });

        $("#downloadBtn").click(function() {
            var gameData = game.pgn();
            if (!gameData) {
                alert("There are no moves to download yet!");
                return;
            }
            var blob = new Blob([gameData], { type: 'text/plain' });
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'My_AI_Chess_Match.txt'; 
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        });
    }

    // ==========================================
    // --- DYNAMIC LICHESS PUZZLE (Screen 7) ---
    // ==========================================
    if ($("#puzzleBoard").length) {
        
        var puzzleBoard = null;
        var puzzleGame = new Chess();
        var currentPuzzleSolution = [];
        var playerMoveIndex = 0;

        async function loadDailyPuzzle() {
            try {
                $("#puzzleSuccess").hide();
                // Reset coach message on new puzzle load
                $("#coachMessage").text('"I am analyzing the new board. Make your move!"');
                
                var response = await fetch('https://lichess.org/api/puzzle/daily');
                var data = await response.json();
                
                var puzzleFen = data.game.pgn; 
                puzzleGame.load_pgn(puzzleFen);
                currentPuzzleSolution = data.puzzle.solution;
                
                var opponentMove = currentPuzzleSolution[0];
                puzzleGame.move({
                    from: opponentMove.substring(0, 2), 
                    to: opponentMove.substring(2, 4), 
                    promotion: opponentMove.length > 4 ? opponentMove.substring(4, 5) : 'q'
                });
                
                playerMoveIndex = 1;
                
                var pBoardConfig = {
                    draggable: true,
                    position: puzzleGame.fen(),
                    onDragStart: function(source, piece) {
                        if (puzzleGame.game_over()) return false;
                        var turn = puzzleGame.turn();
                        if ((turn === 'w' && piece.search(/^b/) !== -1) || 
                            (turn === 'b' && piece.search(/^w/) !== -1)) {
                            return false;
                        }
                    },
                    onDrop: onPuzzleDrop,
                    onSnapEnd: function() { puzzleBoard.position(puzzleGame.fen()); },
                    pieceTheme: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/merida/{piece}.svg'
                };
                
                puzzleBoard = Chessboard('puzzleBoard', pBoardConfig);
                
            } catch (error) {
                console.error("Failed to load Lichess puzzle", error);
                showToast("Error loading daily puzzle. Check internet connection.", true);
            }
        }

        function onPuzzleDrop(source, target) {
            var moveAttempt = source + target; 
            var correctMove = currentPuzzleSolution[playerMoveIndex];

            if (moveAttempt === correctMove || moveAttempt + 'q' === correctMove || moveAttempt + 'n' === correctMove) {
                
                puzzleGame.move({
                    from: source, 
                    to: target, 
                    promotion: correctMove.length > 4 ? correctMove.substring(4, 5) : 'q'
                });
                playerMoveIndex++;

                if (playerMoveIndex >= currentPuzzleSolution.length) {
                    $("#puzzleSuccess").fadeIn();
                    $("#coachMessage").html(`<span class="text-success fw-bold">Outstanding!</span> You found the winning sequence.`);
                } else {
                    setTimeout(function() {
                        var aiResponse = currentPuzzleSolution[playerMoveIndex];
                        puzzleGame.move({
                            from: aiResponse.substring(0,2), 
                            to: aiResponse.substring(2,4), 
                            promotion: aiResponse.length > 4 ? aiResponse.substring(4, 5) : 'q'
                        });
                        puzzleBoard.position(puzzleGame.fen());
                        playerMoveIndex++;
                        
                        if (playerMoveIndex >= currentPuzzleSolution.length) {
                             $("#puzzleSuccess").fadeIn();
                             $("#coachMessage").html(`<span class="text-success fw-bold">Outstanding!</span> You found the winning sequence.`);
                        } else {
                             $("#coachMessage").text('"Good move! I responded. Now find the next critical tactic."');
                        }
                    }, 500);
                }
            } else {
                // THE BLUNDER ANALYZER
                var pieceObj = puzzleGame.get(source); 
                var pieceNames = { 'p': 'Pawn', 'n': 'Knight', 'b': 'Bishop', 'r': 'Rook', 'q': 'Queen', 'k': 'King' };
                var pieceName = pieceNames[pieceObj.type];
                
                $("#coachMessage").html(`<span class="text-danger fw-bold">Blunder Alert!</span> Moving the <strong>${pieceName}</strong> to <strong>${target}</strong> loses your tactical advantage. Undo that and look for a more forcing move!`);
                
                showToast("Incorrect move! Check the AI Coach for details.", true);
                return 'snapback';
            }
        }

        // 1. Initial Load
        loadDailyPuzzle();

        // 2. The Smart Hint System
        $("#hintBtn").click(function() {
            var correctMove = currentPuzzleSolution[playerMoveIndex]; 
            if (!correctMove) return;

            var fromSquare = correctMove.substring(0, 2); 
            var pieceObj = puzzleGame.get(fromSquare);
            var pieceNames = { 'p': 'Pawn', 'n': 'Knight', 'b': 'Bishop', 'r': 'Rook', 'q': 'Queen', 'k': 'King' };
            var pieceName = pieceNames[pieceObj.type];
            
            $("#coachMessage").html(`<span class="text-primary fw-bold">Smart Hint:</span> Focus your attention on your <strong>${pieceName}</strong> sitting on <strong>${fromSquare}</strong>. There is a brilliant move available for it!`);
        });

        // 3. Retry Button
        $("#resetPuzzleBtn").click(function() {
            loadDailyPuzzle();
        });
    }
});