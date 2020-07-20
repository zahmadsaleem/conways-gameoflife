#!/usr/bin/env python3
from random import randint
from typing import List, Tuple
from time import sleep
from os import system
from copy import deepcopy
from sys import argv


class Playground:
    def __init__(self, bounds: Tuple[int, int]):
        columns, rows = bounds
        self.columns = columns
        self.rows = rows
        self.field: List[List[Cell]] = [[Cell(False, (row, col)) for col in range(columns)] for row in range(rows)]

    def randomize(self):
        for column in self.field:
            for cell in column:
                cell.alive = [True, False][randint(0, 1)]

    def update(self):
        new_filed = deepcopy(self.field)
        for r, row in enumerate(self.field):
            for i, oldcell in enumerate(row):
                neighbours = oldcell.neighbours(self)
                neighbours_len = len(neighbours)
                cell = new_filed[r][i]
                if cell.alive:
                    if neighbours_len < 2:
                        cell.die()
                    elif neighbours_len in range(2, 4):
                        pass
                    elif neighbours_len > 3:
                        cell.die()
                elif neighbours_len == 3:
                    # cell is dead
                    cell.live()

        self.field = new_filed

    # TODO: Load state
    # TODO: Save state

    def draw(self):
        system("cls")
        chars = {True: "+", False: "-"}
        for row in self.field:
            for cell in row:
                print(chars[cell.alive], end='')
            print("\n", end='')


class Cell:
    def __init__(self, alive: bool, index: Tuple[int, int]):
        self.alive = alive
        self.index = index

    def die(self):
        self.alive = False

    def live(self):
        self.alive = True

    def neighbours(self, arr: Playground):
        indices = [(self.index[0] + i, self.index[1] + j) for i in range(-1, 2) for j in range(-1, 2)]
        neighbour_list = []
        for row, column in indices:
            if column in range(arr.columns) and row in range(arr.rows):
                #  get cell
                #  check if alive
                #  add to neighbour_list
                neigh = arr.field[row][column]
                if neigh.alive and (row, column) != self.index:
                    neighbour_list.append(neigh)

        return neighbour_list


def main():
    if len(argv) != 4:
        print("Usage main.py <rows> <columns> <iterations>")
        return

    try:
        columns, rows, i = [int(x) for x in argv[1:]]
    except ValueError:
        print("Usage main.py <rows> <columns> <iterations>")
        return

    playground = Playground((columns, rows))
    playground.randomize()
    while i > 0:
        sleep(0.25)
        playground.update()
        playground.draw()
        i -= 1


if __name__ == "__main__":
    main()
