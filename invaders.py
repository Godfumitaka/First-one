#!/usr/bin/env python3
"""
Simple Space Invaders Game
Use arrow keys to move, space to shoot!
"""

import pygame
import random
import sys

# Initialize pygame
pygame.init()

# Screen settings
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Space Invaders")

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GREEN = (0, 255, 0)
RED = (255, 0, 0)
YELLOW = (255, 255, 0)
CYAN = (0, 255, 255)

# Clock for frame rate
clock = pygame.time.Clock()
FPS = 60

# Font
font = pygame.font.Font(None, 36)
large_font = pygame.font.Font(None, 72)


class Player:
    def __init__(self):
        self.width = 50
        self.height = 30
        self.x = SCREEN_WIDTH // 2 - self.width // 2
        self.y = SCREEN_HEIGHT - 60
        self.speed = 6
        self.color = GREEN

    def move(self, direction):
        if direction == "left" and self.x > 0:
            self.x -= self.speed
        if direction == "right" and self.x < SCREEN_WIDTH - self.width:
            self.x += self.speed

    def draw(self):
        # Draw spaceship shape
        points = [
            (self.x + self.width // 2, self.y),  # Top center
            (self.x, self.y + self.height),  # Bottom left
            (self.x + self.width, self.y + self.height),  # Bottom right
        ]
        pygame.draw.polygon(screen, self.color, points)
        # Cockpit
        pygame.draw.circle(
            screen, CYAN, (self.x + self.width // 2, self.y + 15), 8
        )

    def get_rect(self):
        return pygame.Rect(self.x, self.y, self.width, self.height)


class Bullet:
    def __init__(self, x, y):
        self.width = 4
        self.height = 15
        self.x = x - self.width // 2
        self.y = y
        self.speed = 10
        self.color = YELLOW

    def move(self):
        self.y -= self.speed

    def draw(self):
        pygame.draw.rect(
            screen, self.color, (self.x, self.y, self.width, self.height)
        )

    def get_rect(self):
        return pygame.Rect(self.x, self.y, self.width, self.height)

    def is_off_screen(self):
        return self.y < 0


class Enemy:
    def __init__(self, x, y):
        self.width = 40
        self.height = 30
        self.x = x
        self.y = y
        self.color = RED

    def draw(self):
        # Draw alien shape
        pygame.draw.rect(
            screen, self.color, (self.x + 5, self.y, self.width - 10, self.height - 10)
        )
        # Eyes
        pygame.draw.circle(screen, WHITE, (self.x + 12, self.y + 10), 5)
        pygame.draw.circle(screen, WHITE, (self.x + 28, self.y + 10), 5)
        # Tentacles
        pygame.draw.rect(screen, self.color, (self.x, self.y + 20, 8, 10))
        pygame.draw.rect(screen, self.color, (self.x + 32, self.y + 20, 8, 10))

    def get_rect(self):
        return pygame.Rect(self.x, self.y, self.width, self.height)


class EnemyBullet:
    def __init__(self, x, y):
        self.width = 4
        self.height = 10
        self.x = x
        self.y = y
        self.speed = 5
        self.color = RED

    def move(self):
        self.y += self.speed

    def draw(self):
        pygame.draw.rect(
            screen, self.color, (self.x, self.y, self.width, self.height)
        )

    def get_rect(self):
        return pygame.Rect(self.x, self.y, self.width, self.height)

    def is_off_screen(self):
        return self.y > SCREEN_HEIGHT


class Game:
    def __init__(self):
        self.player = Player()
        self.bullets = []
        self.enemies = []
        self.enemy_bullets = []
        self.score = 0
        self.lives = 3
        self.enemy_direction = 1
        self.enemy_speed = 1
        self.game_over = False
        self.game_won = False
        self.shoot_cooldown = 0
        self.enemy_shoot_timer = 0
        self.create_enemies()

    def create_enemies(self):
        self.enemies = []
        for row in range(4):
            for col in range(10):
                x = 80 + col * 60
                y = 50 + row * 50
                self.enemies.append(Enemy(x, y))

    def handle_input(self):
        keys = pygame.key.get_pressed()
        if keys[pygame.K_LEFT]:
            self.player.move("left")
        if keys[pygame.K_RIGHT]:
            self.player.move("right")
        if keys[pygame.K_SPACE] and self.shoot_cooldown <= 0:
            self.shoot()
            self.shoot_cooldown = 15  # Cooldown frames

    def shoot(self):
        bullet = Bullet(
            self.player.x + self.player.width // 2, self.player.y
        )
        self.bullets.append(bullet)

    def enemy_shoot(self):
        if self.enemies and self.enemy_shoot_timer <= 0:
            shooter = random.choice(self.enemies)
            bullet = EnemyBullet(
                shooter.x + shooter.width // 2, shooter.y + shooter.height
            )
            self.enemy_bullets.append(bullet)
            self.enemy_shoot_timer = 60  # Frames between enemy shots

    def move_enemies(self):
        move_down = False
        for enemy in self.enemies:
            if enemy.x + enemy.width >= SCREEN_WIDTH - 10:
                self.enemy_direction = -1
                move_down = True
                break
            elif enemy.x <= 10:
                self.enemy_direction = 1
                move_down = True
                break

        for enemy in self.enemies:
            enemy.x += self.enemy_speed * self.enemy_direction
            if move_down:
                enemy.y += 20

    def check_collisions(self):
        # Player bullets hitting enemies
        for bullet in self.bullets[:]:
            for enemy in self.enemies[:]:
                if bullet.get_rect().colliderect(enemy.get_rect()):
                    if bullet in self.bullets:
                        self.bullets.remove(bullet)
                    if enemy in self.enemies:
                        self.enemies.remove(enemy)
                    self.score += 100
                    break

        # Enemy bullets hitting player
        for bullet in self.enemy_bullets[:]:
            if bullet.get_rect().colliderect(self.player.get_rect()):
                self.enemy_bullets.remove(bullet)
                self.lives -= 1
                if self.lives <= 0:
                    self.game_over = True

        # Enemies reaching player level
        for enemy in self.enemies:
            if enemy.y + enemy.height >= self.player.y:
                self.game_over = True
                break

    def update(self):
        if self.game_over or self.game_won:
            return

        self.handle_input()

        # Update cooldowns
        if self.shoot_cooldown > 0:
            self.shoot_cooldown -= 1
        if self.enemy_shoot_timer > 0:
            self.enemy_shoot_timer -= 1

        # Move bullets
        for bullet in self.bullets[:]:
            bullet.move()
            if bullet.is_off_screen():
                self.bullets.remove(bullet)

        # Move enemy bullets
        for bullet in self.enemy_bullets[:]:
            bullet.move()
            if bullet.is_off_screen():
                self.enemy_bullets.remove(bullet)

        # Move enemies
        self.move_enemies()

        # Enemy shooting
        self.enemy_shoot()

        # Check collisions
        self.check_collisions()

        # Check win condition
        if len(self.enemies) == 0:
            self.game_won = True

    def draw(self):
        screen.fill(BLACK)

        # Draw stars background
        random.seed(42)  # Fixed seed for consistent stars
        for _ in range(100):
            x = random.randint(0, SCREEN_WIDTH)
            y = random.randint(0, SCREEN_HEIGHT)
            pygame.draw.circle(screen, WHITE, (x, y), 1)
        random.seed()  # Reset seed

        # Draw game objects
        self.player.draw()

        for bullet in self.bullets:
            bullet.draw()

        for bullet in self.enemy_bullets:
            bullet.draw()

        for enemy in self.enemies:
            enemy.draw()

        # Draw UI
        score_text = font.render(f"Score: {self.score}", True, WHITE)
        lives_text = font.render(f"Lives: {self.lives}", True, WHITE)
        screen.blit(score_text, (10, 10))
        screen.blit(lives_text, (SCREEN_WIDTH - 120, 10))

        # Game over / win screen
        if self.game_over:
            game_over_text = large_font.render("GAME OVER", True, RED)
            restart_text = font.render("Press R to restart", True, WHITE)
            screen.blit(
                game_over_text,
                (SCREEN_WIDTH // 2 - game_over_text.get_width() // 2, 250),
            )
            screen.blit(
                restart_text,
                (SCREEN_WIDTH // 2 - restart_text.get_width() // 2, 330),
            )

        if self.game_won:
            win_text = large_font.render("YOU WIN!", True, GREEN)
            restart_text = font.render("Press R to restart", True, WHITE)
            screen.blit(
                win_text, (SCREEN_WIDTH // 2 - win_text.get_width() // 2, 250)
            )
            screen.blit(
                restart_text,
                (SCREEN_WIDTH // 2 - restart_text.get_width() // 2, 330),
            )

        pygame.display.flip()

    def restart(self):
        self.__init__()


def main():
    game = Game()

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                if event.key == pygame.K_r and (game.game_over or game.game_won):
                    game.restart()

        game.update()
        game.draw()
        clock.tick(FPS)

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
