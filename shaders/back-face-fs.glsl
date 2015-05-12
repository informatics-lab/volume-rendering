varying vec3 worldSpaceCoords;
void main(){
    //The fragment's world space coordinates as fragment output.
    gl_FragColor = vec4( worldSpaceCoords.x , worldSpaceCoords.y, worldSpaceCoords.z, 1 );
}