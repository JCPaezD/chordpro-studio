#line 1 "<embedded>/Encode/Encoding.pm"
package Encode::Encoding;

# Base class for classes which implement encodings
use strict;
use warnings;
our $VERSION = do { my @r = ( q$Revision: 2.8 $ =~ /\d+/g ); sprintf "%d." . "%02d" x $#r, @r };

our @CARP_NOT = qw(Encode Encode::Encoder);

use Carp ();
use Encode ();
use Encode::MIME::Name;

use constant DEBUG => !!$ENV{PERL_ENCODE_DEBUG};

sub Define {
    my $obj       = shift;
    my $canonical = shift;
    $obj = bless { Name => $canonical }, $obj unless ref $obj;

    # warn "$canonical => $obj\n";
    Encode::define_encoding( $obj, $canonical, @_ );
}

sub name { return shift->{'Name'} }

sub mime_name {
    return Encode::MIME::Name::get_mime_name(shift->name);
}

sub renew {
    my $self = shift;
    my $clone = bless {%$self} => ref($self);
    $clone->{renewed}++;    # so the caller can see it
    DEBUG and warn $clone->{renewed};
    return $clone;
}

sub renewed { return $_[0]->{renewed} || 0 }

*new_sequence = \&renew;

sub needs_lines { 0 }

sub perlio_ok {
    return eval { require PerlIO::encoding } ? 1 : 0;
}

# (Temporary|legacy) methods

sub toUnicode   { shift->decode(@_) }
sub fromUnicode { shift->encode(@_) }

#
# Needs to be overloaded or just croak
#

sub encode {
    my $obj = shift;
    my $class = ref($obj) ? ref($obj) : $obj;
    Carp::croak( $class . "->encode() not defined!" );
}

sub decode {
    my $obj = shift;
    my $class = ref($obj) ? ref($obj) : $obj;
    Carp::croak( $class . "->encode() not defined!" );
}

sub DESTROY { }

1;
__END__

#line 357
