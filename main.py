from random import randint
from typing import List, Tuple
from time import sleep
from os import system
from copy import deepcopy


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


def update(arr: Playground):
    newarr = deepcopy(arr)
    for r, row in enumerate(arr.field):
        for i, oldcell in enumerate(row):
            neighbours = oldcell.neighbours(arr)
            neighbours_len = len(neighbours)
            cell = newarr.field[r][i]
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

    return newarr


def draw(arr: Playground):
    system("cls")
    chars = {True: "0", False: " "}
    for row in arr.field:
        for cell in row:
            print(chars[cell.alive], end='')
        print("\n", end='')


def main():
    columns = 100
    rows = 10
    arr = Playground((columns, rows))
    arr.randomize()
    i = 0
    while i < 100:
        sleep(0.25)
        arr = update(arr)
        draw(arr)
        i += 1


if __name__ == "__main__":
    main()
