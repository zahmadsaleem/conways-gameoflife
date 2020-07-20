#!/usr/bin/env python3
import argparse
from random import randint
from typing import List, Tuple
from time import sleep
from os import system
from copy import deepcopy
from sys import argv
import json
from os.path import abspath


class Playground:
    def __init__(self, bounds: Tuple[int, int]):
        rows, columns = bounds
        self.rows = rows
        self.columns = columns
        self.field: List[List[Cell]] = [[Cell(False, (row, col)) for col in range(columns)] for row in range(rows)]

    # TODO: clip
    # TODO: paste
    # TODO: overflow bounds
    # TODO: extend
    # TODO: shrink

    def randomize(self):
        def process_cell(cell):
            cell.alive = [True, False][randint(0, 1)]

        self.map_to_field(process_cell)

    def map_to_field(self, process_cell, do_before_row=None, do_after_row=None):
        for r, row in enumerate(self.field):
            results = None
            if do_before_row is not None:
                results = do_before_row(row_index=r, row=row)
            for cell in row:
                process_cell(cell)
            if do_after_row is not None:
                do_after_row(row_index=r, row=row, results=results)

    def update(self):
        new_filed = deepcopy(self.field)

        def process_cell(cell):
            neighbours = cell.neighbours(self)
            neighbours_len = len(neighbours)
            cell = new_filed[cell.index[0]][cell.index[1]]
            if cell.alive:
                if neighbours_len < 2:
                    cell.die()
                elif neighbours_len in range(2, 4):
                    # keep alive
                    pass
                elif neighbours_len > 3:
                    cell.die()
            elif neighbours_len == 3:
                # cell is dead
                cell.live()

        self.map_to_field(process_cell)

        self.field = new_filed

    @classmethod
    def from_file(cls, path):

        with open(path, "r") as f:
            playground_dict = json.load(f)

        field = playground_dict.get("field")
        columns = playground_dict.get("columns")
        rows = playground_dict.get("rows")
        if field and columns and rows:
            playground = cls((rows, columns))
            playground.load(field)
            return playground

        raise ValueError("File doesnt seem right")

    def load(self, field):
        def process_cell(cell):
            cell.alive = bool(field[cell.index[0]][cell.index[1]])

        self.map_to_field(process_cell)

    def save(self, fpath):
        playground_dict = {"columns": self.columns, "rows": self.rows,
                           "field": [[int(cell.alive) for cell in row] for row in self.field]}
        with open(fpath, "w+") as f:
            json.dump(playground_dict, f, indent=4)

    def draw(self):
        system("cls")
        chars = {True: "0", False: "-"}

        def process_cell(cell):
            print(chars[cell.alive], end='')

        def do_after_row(**kwargs):
            print("\n", end='')

        self.map_to_field(process_cell, do_after_row=do_after_row)


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
                neighbour = arr.field[row][column]
                #  check if alive
                if neighbour.alive and (row, column) != self.index:
                    #  add to neighbour_list
                    neighbour_list.append(neighbour)

        return neighbour_list


def play(playground, i):
    while i > 0:
        sleep(0.25)
        playground.update()
        playground.draw()
        i -= 1


def parse_args(parser, args):
    x = parser.parse_args(args)
    fpath = None
    if hasattr(x, "fpath"):
        # file_parser
        fpath = abspath(x.fpath)
        playground = Playground.from_file(fpath)
    else:
        # grid_parser
        playground = Playground((x.rows, x.columns))
        playground.randomize()

    # could be either parsers
    if hasattr(x, "save"):
        # grid_parser
        if not x.save:
            fpath = None
        # file_parser
        elif not fpath:
            fpath = abspath(x.save)

    else:
        #  dont save
        fpath = None

    return playground, x.iterations, fpath


class ErrorCatchingArgumentParser(argparse.ArgumentParser):
    def exit(self, status=0, message=None):
        if status:
            raise Exception(f'Exiting because of an error: {message}')

    def error(self, message):
        self.exit(2, message=message)


def setup_parser():
    usage = """
    \tmain.py [--save <filepath>] <rows> <columns> <iterations>
    \tmain.py [--save] <filepath> <iterations>
    """

    grid_parser = ErrorCatchingArgumentParser(prog="Game of Life", usage=usage)
    grid_parser.add_argument('--save')
    grid_parser.add_argument('rows', type=int)
    grid_parser.add_argument('columns', type=int)
    grid_parser.add_argument('iterations', type=int)

    file_parser = ErrorCatchingArgumentParser(prog="Game of Life", usage=usage)
    file_parser.add_argument('--save', action='store_true')
    file_parser.add_argument('fpath')
    file_parser.add_argument('iterations', type=int)

    return [grid_parser, file_parser]


def main():
    grid_parser, file_parser = setup_parser()
    try:
        playground, iterations, fpath = parse_args(grid_parser, argv[1:])
    except:
        playground, iterations, fpath = parse_args(file_parser, argv[1:])

    play(playground, iterations)
    if fpath:
        playground.save(fpath)


if __name__ == "__main__":
    main()
