# This program uses the "turtle" module to draw shapes on the screen.
# Imagine a tiny turtle holding a pen. When the pen is down, it draws
# as the turtle walks around. When the pen is up, it moves without drawing.
import turtle

# Make our turtle. We'll call it "t" for short, like a nickname.
t = turtle.Turtle()


# This function draws a hexagon (a shape with 6 equal sides, like a honeycomb).
# "side_length" is how long each side of the hexagon will be.
def draw_hex(side_length):
	t.pendown()  # Put the pen down so the turtle starts drawing.
	# Repeat 6 times, once for each side of the hexagon.
	for _ in range(6):
		t.forward(side_length)  # Walk forward to draw one side.
		t.right(60)             # Turn right 60 degrees to start the next side.
		# (A full circle is 360 degrees. 360 ÷ 6 sides = 60 degrees per turn.)
	t.penup()  # Lift the pen so the turtle can move without drawing.


# This function draws a square (a shape with 4 equal sides).
# "side_length" is how long each side of the square will be.
def draw_square(side_length):
	t.pendown()  # Pen down: start drawing.
	# Repeat 4 times, once for each side of the square.
	for _ in range(4):
		t.forward(side_length)  # Walk forward to draw one side.
		t.right(90)             # Turn right 90 degrees (a square corner).
		# (360 degrees ÷ 4 sides = 90 degrees per turn.)
	t.penup()  # Pen up: stop drawing.


# Now we use our functions to draw a pattern!
# This loop runs 3 times, so we'll draw 3 sets of hexagons.
for _ in range(3):
	# Draw a big hexagon with sides of 250 steps.
	draw_hex(250)

	# Turn right and walk forward (no drawing) to move to a new spot.
	t.right(90)
	t.forward(60)

	# Draw a smaller hexagon with sides of 100 steps.
	draw_hex(100)

	# Move again to a new spot for the next hexagon.
	t.right(90)
	t.forward(40)

	# Draw a medium hexagon with sides of 120 steps.
	draw_hex(120)

# After the loop, move forward 300 steps and turn right 60 degrees
# to get into position for the squares.
t.forward(300)
t.right(60)

# Draw a big square with sides of 270 steps.
draw_square(270)

# Turn and move to a new spot for the next square.
t.left(30)
t.forward(110)
t.right(80)

# Draw a smaller square with sides of 135 steps.
draw_square(135)

# Tell the turtle program we're done. This keeps the picture window open
# so we can see our drawing.
turtle.done()
