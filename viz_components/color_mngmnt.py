import seaborn as seaborn

# colour manipulation helpers for viz components


def to_rgb(t):
    """ Take rgb value specified as a tuple or list of 3 [0, 1] components, convert to list of [0, 255] components. """
    return list(map(lambda x: int(x * 255), t))


def to_hex(rgb):
    """ Take rgb colour specified as a list of three [0, 255] components, return the corresponding hex string. """
    return '#%02x%02x%02x' % (rgb[0], rgb[1], rgb[2])


def make_color_pal(n: int, pal_type='colorblind'):
    """
    Generate a colour palette

    n -- the nuber of entries desired

    pal_type -- the name of the underlying colour scheme

    See seaborn documentation at https://seaborn.pydata.org/tutorial/color_palettes.html
    for available options; 'colorblind', the default, is matplotlib's colorblind palette.
    """
    return list(map(lambda t: to_hex(to_rgb(t)), seaborn.color_palette(pal_type, n)))
